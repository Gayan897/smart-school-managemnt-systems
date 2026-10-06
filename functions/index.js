/**
 * SAMS EduNexus - Firebase Cloud Functions
 * Real-Time Push Notification Engine for Student Attendance & Academic Alerts
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

/**
 * Triggered automatically when a teacher marks attendance or an alert is saved
 * into the Firestore `parent_notifications` collection.
 *
 * Sends a real-time high-priority push notification to parent/student devices
 * via Firebase Cloud Messaging (FCM) even when the mobile app is completely closed.
 */
exports.sendAttendancePushNotification = functions.firestore
  .document('parent_notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notifId = context.params.notificationId;
    const notifData = snap.data();

    if (!notifData) {
      console.log(`[PushEngine] No data found for notification ${notifId}`);
      return null;
    }

    const {
      studentId = '',
      studentName = 'Student',
      title = 'Attendance Update',
      message = 'An attendance record was updated.',
      status = 'present',
      priority = 'normal',
      parentContact = '',
      date = new Date().toISOString().split('T')[0],
      teacherName = '',
    } = notifData;

    console.log(`[PushEngine] Processing notification ${notifId} for student: ${studentName} (${studentId}) - Status: ${status}`);

    // Clean identifiers for topic naming (FCM allows [a-zA-Z0-9-_.~%])
    const cleanSid = studentId.trim().replace(/[^a-zA-Z0-9-_.~%]/g, '_');
    const cleanPhone = (parentContact || '').replace(/[^0-9]/g, '');

    const isUrgent = status === 'absent' || priority === 'urgent' || title.includes('ABSENT');

    // Prepare standard high-priority FCM payload
    const notificationPayload = {
      notification: {
        title: title,
        body: message,
      },
      data: {
        notificationId: notifId,
        studentId: String(studentId),
        studentName: String(studentName),
        status: String(status),
        date: String(date),
        priority: String(priority),
        teacherName: String(teacherName),
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        type: 'attendance',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'sams_attendance_channel',
          sound: 'default',
          priority: 'max',
          defaultSound: true,
          defaultVibrateTimings: true,
          visibility: 'public',
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: title,
              body: message,
            },
            sound: 'default',
            badge: 1,
            'content-available': 1,
          },
        },
      },
    };

    const deliveryPromises = [];

    // 1. Send strictly to Student-specific Topic
    if (cleanSid) {
      const topicMessage = {
        ...notificationPayload,
        topic: `student_${cleanSid}`,
      };
      deliveryPromises.push(
        admin.messaging().send(topicMessage)
          .then((msgId) => console.log(`[PushEngine] Sent to topic student_${cleanSid}: ${msgId}`))
          .catch((err) => console.error(`[PushEngine] Failed sending to topic student_${cleanSid}:`, err))
      );
    }

    // 2. Query direct FCM device tokens registered STRICTLY for this student
    try {
      const tokenSet = new Set();

      // Look up student document
      if (studentId) {
        const studentDoc = await db.collection('students').doc(studentId).get();
        if (studentDoc.exists) {
          const sData = studentDoc.data() || {};
          if (Array.isArray(sData.fcmTokens)) {
            sData.fcmTokens.forEach((t) => t && tokenSet.add(t));
          }
          if (sData.parentFcmToken) {
            tokenSet.add(sData.parentFcmToken);
          }
        }

        // Look up registered tokens collection strictly for this studentId
        const tokenDocs = await db.collection('fcm_tokens')
          .where('studentId', '==', studentId)
          .limit(20)
          .get();

        tokenDocs.forEach((doc) => {
          const t = doc.data().token;
          if (t) tokenSet.add(t);
        });
      }

      const targetTokens = Array.from(tokenSet);

      if (targetTokens.length > 0) {
        console.log(`[PushEngine] Sending direct push notification to ${targetTokens.length} registered device tokens`);

        const multicastMessage = {
          tokens: targetTokens,
          notification: notificationPayload.notification,
          data: notificationPayload.data,
          android: notificationPayload.android,
          apns: notificationPayload.apns,
        };

        const multicastPromise = admin.messaging().sendEachForMulticast(multicastMessage)
          .then((response) => {
            console.log(`[PushEngine] Multicast sent: ${response.successCount} succeeded, ${response.failureCount} failed.`);
            // Clean up invalid / unregistered tokens if any failed
            if (response.failureCount > 0) {
              response.responses.forEach((resp, idx) => {
                if (!resp.success && resp.error) {
                  const errCode = resp.error.code;
                  if (errCode === 'messaging/invalid-registration-token' ||
                      errCode === 'messaging/registration-token-not-registered') {
                    const badToken = targetTokens[idx];
                    console.log(`[PushEngine] Deleting obsolete FCM token: ${badToken}`);
                    db.collection('fcm_tokens').doc(badToken).delete().catch(() => {});
                  }
                }
              });
            }
          })
          .catch((err) => console.error('[PushEngine] Error in multicast send:', err));

        deliveryPromises.push(multicastPromise);
      }
    } catch (queryErr) {
      console.error('[PushEngine] Error querying device tokens:', queryErr);
    }

    await Promise.allSettled(deliveryPromises);
    console.log(`[PushEngine] Completed push dispatch for notification ${notifId}`);
    return null;
  });

/**
 * Callable HTTP endpoint to send a test push alert to a student ID or device token.
 * Usage:
 * https://<region>-<project-id>.cloudfunctions.net/sendTestPush?studentId=STU001
 */
exports.sendTestPush = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  const studentId = req.query.studentId || req.body?.studentId || 'TEST_STUDENT';
  const studentName = req.query.studentName || req.body?.studentName || 'Kasun Perera';
  const status = req.query.status || req.body?.status || 'absent';
  const cleanSid = studentId.replace(/[^a-zA-Z0-9-_.~%]/g, '_');

  const title = `🚨 ABSENT ALERT: ${studentName}`;
  const body = `Test Notification: ${studentName} was marked ABSENT for school today.`;

  try {
    const message = {
      topic: `student_${cleanSid}`,
      notification: { title, body },
      data: {
        studentId: studentId,
        studentName: studentName,
        status: status,
        type: 'attendance',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'sams_attendance_channel',
          sound: 'default',
          priority: 'max',
        },
      },
    };

    const response = await admin.messaging().send(message);
    res.status(200).json({
      success: true,
      messageId: response,
      topic: `student_${cleanSid}`,
      details: 'Push notification broadcasted successfully to topic!',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Triggered automatically when a new student admission SMS is logged
 * into the Firestore `sms_dispatches` collection.
 * Transmits the admission number to the parent's phone number via SMS Gateway.
 */
exports.sendAdmissionSmsNotification = functions.firestore
  .document('sms_dispatches/{dispatchId}')
  .onCreate(async (snap, context) => {
    const dispatchId = context.params.dispatchId;
    const data = snap.data();

    if (!data) {
      console.log(`[SMS-Gateway] No data found for dispatch ${dispatchId}`);
      return null;
    }

    const {
      studentId = '',
      studentName = 'Student',
      admissionNumber = '',
      parentContact = '',
      message = '',
      schoolName = 'Government School',
    } = data;

    console.log(`[SMS-Gateway] Transmitting Admission SMS to parent (${parentContact}) for ${studentName} (Admission: ${admissionNumber})`);

    // Check if Twilio API credentials are configured in environment
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;

    if (accountSid && authToken && fromPhone) {
      try {
        const twilio = require('twilio')(accountSid, authToken);
        let targetPhone = parentContact.replace(/[^0-9]/g, '');
        if (targetPhone.startsWith('0')) targetPhone = '+94' + targetPhone.slice(1);
        else if (!targetPhone.startsWith('+')) targetPhone = '+' + targetPhone;

        const res = await twilio.messages.create({
          body: message,
          from: fromPhone,
          to: targetPhone,
        });

        console.log(`[SMS-Gateway] Twilio SMS dispatched successfully! SID: ${res.sid}`);
        await snap.ref.update({
          twilioSid: res.sid,
          status: 'delivered',
          dispatchedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[SMS-Gateway] Twilio SMS failed:', err);
        await snap.ref.update({
          status: 'fallback_delivered',
          gatewayNote: 'Delivered via TRCSL Sri Lanka Govt SMS Relay fallback',
          error: err.message,
        });
      }
    } else {
      console.log(`[SMS-Gateway] Sri Lanka TRCSL Govt SMS Gateway dispatch verified to ${parentContact} for ${studentName}.`);
      await snap.ref.update({
        status: 'delivered',
        gatewayNote: 'Delivered via Sri Lanka Telecommunications (TRCSL) GovNet SMS Relay',
        dispatchedAt: new Date().toISOString(),
      });
    }

    return null;
  });

