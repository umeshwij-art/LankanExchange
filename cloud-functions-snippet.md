/**
 * Colombo Exchange Cloud Function Snippet
 * Purpose: Send email notification to Admin when new feedback is submitted.
 * Target: Firebase Cloud Functions (Node.js)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

// Configure your email provider (e.g., SendGrid, Gmail, etc.)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const onFeedbackCreated = functions.firestore
  .document('feedback/{feedbackId}')
  .onCreate(async (snap, context) => {
    const feedback = snap.data();
    const feedbackId = context.params.feedbackId;

    const mailOptions = {
      from: '"Colombo Exchange System" <no-reply@colomboexchange.lk>',
      to: 'admin@colomboexchange.lk',
      subject: `New Feedback Submitted: [${feedback.category}]`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #1E3A8A;">New Feedback Received</h2>
          <p><strong>Alias:</strong> ${feedback.alias}</p>
          <p><strong>Category:</strong> ${feedback.category}</p>
          <p><strong>Message:</strong></p>
          <blockquote style="background: #f4f4f4; padding: 15px; border-left: 5px solid #1E3A8A;">
            ${feedback.text}
          </blockquote>
          <p><strong>AI Auto-Reply Sent:</strong></p>
          <p style="font-style: italic; color: #666;">"${feedback.aiReply || 'N/A'}"</p>
          <hr />
          <p style="font-size: 10px; color: #999;">ID: ${feedbackId} | UID: ${feedback.uid}</p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`Notification email sent for feedback ${feedbackId}`);
    } catch (error) {
      console.error('Error sending email:', error);
    }
  });
