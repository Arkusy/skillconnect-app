-- Update Privacy Policy with professional content
UPDATE app_legal_docs
SET content = 'Last updated: January 25, 2026

1. Introduction
Welcome to our application ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. If you have any questions or concerns about our policy, or our practices with regards to your personal information, please contact us.

2. Information We Collect
We collect personal information that you voluntarily provide to us when registering at the application, expressing an interest in obtaining information about us or our products and services, when participating in activities on the App or otherwise contacting us.
- Personal Data: Name, email address, phone number, and other similar contact data.
- Credentials: Passwords, password hints, and similar security information used for authentication and account access.
- Payment Data: We may collect data necessary to process your payment if you make purchases, such as your payment instrument number (such as a credit card number), and the security code associated with your payment instrument.

3. How We Use Your Information
We use personal information collected via our App for a variety of business purposes described below:
- To facilitate account creation and logon process.
- To send you marketing and promotional communications.
- To fulfill and manage your orders.
- To post testimonials.
- To deliver targeted advertising to you.
- To request feedback.

4. Will Your Information Be Shared with Anyone?
We only share information with your consent, to comply with laws, to provide you with services, to protect your rights, or to fulfill business obligations. We may process or share data based on the following legal basis:
- Consent: We may process your data if you have given us specific consent to use your personal information in a specific purpose.
- Legitimate Interests: We may process your data when it is reasonably necessary to achieve our legitimate business interests.
- Legal Obligations: We may disclose your information where we are legally required to do so.

5. Data Retention & Account Deletion
We will only keep your personal information for as long as it is necessary for the purposes set out in this privacy policy, unless a longer retention period is required or permitted by law.
- Deletion Policy: If you request to delete your account, your account will be immediately deactivated. However, your data will be retained in our secure archives for a period of 30 days ("Grace Period") before being permanently purged from our systems. This allows for account recovery in case of accidental deletion or to comply with regulatory requirements.

6. Data Security
We have implemented appropriate technical and organizational security measures designed to protect the security of any personal information we process. However, please also remember that we cannot guarantee that the internet itself is 100% secure. Although we will do our best to protect your personal information, transmission of personal information to and from our App is at your own risk.

7. Your Privacy Rights
In some regions (like the European Economic Area), you have certain rights under applicable data protection laws. These may include the right (i) to request access and obtain a copy of your personal information, (ii) to request rectification or erasure; (iii) to restrict the processing of your personal information; and (iv) if applicable, to data portability.

8. Updates to this Policy
We may update this privacy policy from time to time. The updated version will be indicated by an updated "Revised" date and the updated version will be effective as soon as it is accessible.'
WHERE doc_type = 'privacy';

-- Update Terms of Service with professional content
UPDATE app_legal_docs
SET content = 'Last updated: January 25, 2026

1. Agreement to Terms
These Terms of Service constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you") and our application ("we," "us" or "our"), concerning your access to and use of our mobile application (the "App"). By accessing the App, you have read, understood, and agreed to be bound by all of these Terms of Service.

2. Intellectual Property Rights
Unless otherwise indicated, the App is our proprietary property and all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics on the App (collectively, the "Content") and the trademarks, service marks, and logos contained therein (the "Marks") are owned or controlled by us or licensed to us, and are protected by copyright and trademark laws.

3. User Representations
By using the App, you represent and warrant that:
(1) all registration information you submit will be true, accurate, current, and complete;
(2) you will maintain the accuracy of such information and promptly update such registration information as necessary;
(3) you have the legal capacity and you agree to comply with these Terms of Service;
(4) you are not a minor in the jurisdiction in which you reside;
(5) you will not access the App through automated or non-human means, whether through a bot, script or otherwise.

4. Prohibited Activities
You may not access or use the App for any purpose other than that for which we make the App available. The App may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us. Systematically retrieving data or other content from the App to create or compile, directly or indirectly, a collection, compilation, database, or directory without written permission from us is prohibited.

5. User Generated Contributions
The App may invite you to chat, contribute to, or participate in blogs, message boards, online forums, and other functionality, and may provide you with the opportunity to create, submit, post, display, transmit, perform, publish, distribute, or broadcast content and materials to us or on the App, including but not limited to text, writings, video, audio, photographs, graphics, comments, suggestions, or personal information or other material (collectively, "Contributions"). Contributions may be viewable by other users of the App.

6. Account Termination
We may terminate or suspend your account access immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
- Voluntary Termination: You may terminate your account at any time via the Settings menu. Upon request, your account will be disabled immediately, and your data will be scheduled for permanent deletion after 30 days.

7. Modifications and Interruptions
We reserve the right to change, modify, or remove the contents of the App at any time or for any reason at our sole discretion without notice. We will not be liable to you or any third party for any modification, price change, suspension, or discontinuance of the App. We cannot guarantee the App will be available at all times. We may experience hardware, software, or other problems or need to perform maintenance related to the App, resulting in interruptions, delays, or errors.

8. Governing Law
These Terms shall be governed by and defined following the laws of your jurisdiction. You and we irrevocably consent that the courts of your jurisdiction shall have exclusive jurisdiction to resolve any dispute which may arise in connection with these terms.

9. Contact Us
In order to resolve a complaint regarding the App or to receive further information regarding use of the App, please contact us.'
WHERE doc_type = 'terms';
