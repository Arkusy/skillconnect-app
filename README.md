# SkillConnect

A modern React Native mobile application that connects customers with skilled service providers. Built with Expo and Supabase, SkillConnect is a comprehensive service marketplace platform featuring advanced admin controls, real-time chat, worker management, and seamless communication tools.

## Overview

SkillConnect is a full-featured service marketplace platform that enables users to:
- Browse and search for skilled workers across multiple service categories
- Create and manage service requests with detailed specifications and image attachments
- Communicate with service providers through real-time chat
- Track order status and service history with live updates
- Rate and review completed services
- Upgrade to worker status and manage worker profiles
- Access comprehensive admin dashboard for platform management

## Features

### For Customers
- **Service Discovery**: Browse workers by category with ratings, pricing (per day/per hour/fixed), and availability
- **Smart Search**: Find the right service provider based on category, rating, and location
- **Broadcast Orders**: Create service requests and broadcast them to multiple workers in selected categories
- **Order Management**: Create detailed service requests with descriptions, images, and custom pricing
- **Real-Time Chat**: Direct messaging with workers including image sharing and message history
- **Order Tracking**: Monitor service requests from creation to completion with status updates
- **Rating System**: Provide feedback and ratings after service completion
- **Profile Management**: Update personal information, contact details, address, and avatar
- **Help Center**: Direct support chat with admin
- **User Reporting**: Report problematic users or workers

### For Workers
- **Worker Upgrade**: Apply for worker status with subscription-based access
- **Payment System**: Pay for worker rights via UPI with UTR submission and verification
- **Worker Profile**: Manage pricing (per day/per hour/fixed), categories, and ratings
- **Order Requests**: Receive and respond to broadcast orders from customers
- **Subscription Management**: Track worker rights expiration and payment status
- **Verification System**: Submit verification requests to become a verified worker

### Admin Panel
- **Dashboard Analytics**: 
  - Real-time platform statistics (total users, active workers, total orders)
  - Revenue tracking and payment monitoring
  - User growth analytics and engagement metrics
- **User Management**: 
  - View all users with filtering (workers, customers, payment status)
  - Manage user roles and permissions
  - Ban/unban users with customizable duration
  - Track user activity and order history
- **Worker Verification**:
  - Review worker verification requests
  - Approve/reject worker applications
  - Manage worker rights and expiration dates
- **Payment Verification**:
  - Review UPI payment submissions with UTR numbers
  - Verify worker payment proofs
  - Grant worker rights upon payment confirmation
- **Order Management**:
  - Monitor all platform orders
  - Filter by status (active, completed, cancelled)
  - View order details and customer-worker interactions
- **Issue Resolution**:
  - Handle user reports and complaints
  - Review flagged content
  - Take action on problematic users
- **Help Center**:
  - Support chat with users
  - Track unread support messages
  - Manage user inquiries

### Platform Features
- **Email Authentication**: Secure login and registration with email verification via OTP
- **Password Recovery**: Password reset flow with email verification
- **Category System**: Organized service categories (Plumbing, Electrical, Carpentry, Painting, Cleaning, AC Repair)
- **Featured Workers**: Highlighted top-rated and verified service providers
- **Platform Statistics**: Real-time metrics on active workers, completed jobs, and average ratings
- **Image Upload**: Attach photos to service requests and chat messages
- **Responsive UI**: Modern interface with smooth animations and haptic feedback
- **Settings System**: Comprehensive user settings (notifications, privacy, account management)
- **Legal Pages**: Privacy policy and terms of service
- **Conditional Routing**: Role-based routing (admin vs regular users)
- **Biometric Lock**: Optional biometric authentication for additional security
- **Location Services**: Worker and customer location tracking for better service matching

## Tech Stack

### Frontend
- **React Native** (v0.81.5) - Cross-platform mobile framework
- **Expo** (~54.0) - Development platform and toolchain
- **TypeScript** (~5.9.2) - Type-safe JavaScript
- **Expo Router** (~6.0) - File-based navigation with nested routes
- **React Navigation** (^7.1.6) - Advanced navigation library

### Backend & Services
- **Supabase** (^2.76.1) - Backend-as-a-Service (Authentication, Database, Storage, Real-time)
- **Firebase** (^12.4.0) - Push notifications (FCM)

### Key Libraries
- **@supabase/supabase-js** (^2.76.1) - Supabase client for database and auth
- **expo-notifications** (^0.32.13) - Push notification handling
- **expo-image-picker** (~17.0.10) - Image selection and camera functionality
- **react-native-reanimated** (~4.1.1) - Advanced animations and gestures
- **react-native-gesture-handler** (~2.28.0) - Gesture handling
- **expo-haptics** (~15.0.7) - Haptic feedback for better UX
- **@expo/vector-icons** (^15.0.2) - Comprehensive icon library
- **expo-image** (~3.0.10) - Optimized image component
- **expo-location** (~19.0.8) - Location services
- **expo-local-authentication** (~17.0.8) - Biometric authentication
- **react-native-keyboard-controller** (1.18.5) - Advanced keyboard handling
- **react-native-image-viewing** (^0.2.2) - Full-screen image viewer

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development) or Android Studio (for Android development)
- Expo Go app (for testing on physical devices)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/SkillConnect.git
cd SkillConnect
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   Create a `.env` file in the root directory:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server:
```bash
npm start
```

## Available Scripts

- `npm start` - Start the Expo development server
- `npm run android` - Run on Android device/emulator
- `npm run ios` - Run on iOS simulator
- `npm run web` - Run in web browser
- `npm run lint` - Run ESLint for code quality
- `npm run build` - Build Android app with EAS Build
- `npm run update` - Push OTA updates via EAS Update
- `npm run reset-project` - Reset project to initial state

## Project Structure

```
SkillConnect/
├── app/
│   ├── (admin)/             # Admin panel screens
│   │   ├── Home.tsx         # Admin dashboard home
│   │   ├── Dashboard.tsx    # Analytics and metrics
│   │   ├── users.tsx        # User management
│   │   ├── VerifyWorkers.tsx # Worker verification
│   │   ├── Issue.tsx        # Issue reports
│   │   ├── help.tsx         # Support chat
│   │   ├── Account.tsx      # Admin account settings
│   │   └── _layout.tsx
│   ├── (auth)/              # Authentication screens
│   │   ├── login.tsx        # Login and registration
│   │   └── _layout.tsx
│   ├── (tabs)/              # Main app tabs
│   │   ├── Home.tsx         # Home screen with categories
│   │   ├── Chat.tsx         # Chat list
│   │   ├── MyOrders.tsx     # Order management
│   │   ├── Account.tsx      # User profile
│   │   └── _layout.tsx
│   ├── help-center/         # Customer support
│   │   └── index.tsx        # Help center chat
│   ├── ChatScreen.tsx       # Individual chat view
│   ├── NewOrder.tsx         # Create/broadcast service request
│   ├── DisplayOrder.tsx     # Order details
│   ├── WorkerList.tsx       # Workers by category
│   ├── WorkerUpgrade.tsx    # Worker subscription/upgrade
│   ├── PaymentScreen.tsx    # Payment submission
│   ├── Updates.tsx          # Notification center
│   ├── ReportUser.tsx       # User reporting
│   ├── userProfile.tsx      # View other users' profiles
│   ├── settings.tsx         # App settings
│   ├── legal.tsx            # Privacy & terms
│   └── _layout.tsx          # Root layout with role-based routing
├── components/              # Reusable components
│   ├── Avatar.tsx
│   ├── CaptchaModal.tsx
│   ├── CustomAlert.tsx
│   ├── LoadingOverlay.tsx
│   ├── Ratingmodal.tsx
│   ├── BiometricLockOverlay.tsx
│   ├── ChangePasswordModal.tsx
│   ├── BanDurationModal.tsx
│   ├── BannedUserModal.tsx
│   └── HelpChatScreen.tsx
├── utils/                   # Utility functions
│   ├── auth.ts              # Authentication helpers
│   ├── supabase.ts          # Supabase client
│   ├── useAuth.ts           # Auth hook
│   ├── useProfile.ts        # Profile hook
│   ├── chatTypes.ts         # Chat type definitions
│   ├── chatUtils.ts         # Chat utilities
│   ├── helpTypes.ts         # Help center types
│   ├── helpUtils.ts         # Help center utilities
│   ├── notifications.ts     # Notification helpers
│   ├── sendNotification.ts  # Push notification service
│   └── workerUtils.ts       # Worker management utilities
├── context/                 # React Context providers
│   └── AuthContext.tsx
├── constants/               # App constants
│   └── Colors.ts
├── hooks/                   # Custom React hooks
│   ├── useColorScheme.ts
│   └── useNotifications.ts
├── assets/                  # Images, fonts, icons
├── supabase/                # Supabase migrations and functions
│   ├── functions/
│   ├── schema_updates.sql
│   └── config.toml
└── package.json
```

## Configuration

### Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)

2. Set up the following tables:
   - `profiles` - User profiles with role management (role: 0=admin, 1=worker, 2=customer), ban fields, avatar_locked
   - `categories` - Service categories with icons and colors
   - `worker_profiles` - Worker information, ratings, pricing, and verification status
   - `worker_subscriptions` - Worker rights and subscription tracking
   - `worker_verification` - Worker verification requests with documents
   - `worker_status_history` - Worker status change audit log
   - `orders` - Service requests with status tracking
   - `ratings` - Reviews and ratings with comments
   - `messages` - Chat messages with image support
   - `conversations` - Chat thread metadata
   - `issues` - User/worker reports and complaints with reported_user_id
   - `notifications` - In-app notifications with type, title, message, read status
   - `app_legal_docs` - Privacy policy and terms of service content

3. Configure Storage buckets:
   - `avatars` - User profile images
   - `order-images` - Service request photos
   - `chat-images` - Chat message images
   - `payment-proofs` - UPI payment screenshots (if applicable)

4. Enable Email Authentication in Supabase dashboard:
   - Configure OTP-based email verification
   - Set up password recovery emails

5. Configure Real-time subscriptions for:
   - Messages (chat functionality)
   - Orders (live order updates)
   - Worker profiles (live status updates)

### Firebase Setup

1. Create a Firebase project at [firebase.google.com](https://firebase.google.com)

2. Enable Firebase Cloud Messaging (FCM) for push notifications

3. Download `google-services.json` and place it in the project root

4. Configure Firebase in your app

### Environment Variables

Create a `.env` file in the root directory with the following:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Admin Access Setup

To grant admin access to a user:
1. Sign up as a regular user in the app
2. In Supabase Table Editor, go to the `profiles` table
3. Find the user record and change the `role` column value to `0`
   - `0`: Admin
   - `1`: Worker (Has worker rights)
   - `2`: Customer (Default)

## Building for Production

### Android

```bash
npm run build
```

This uses EAS Build with the preview profile configured in `eas.json`.

### iOS

Follow Expo's EAS Build documentation for iOS builds. Configure your Apple Developer credentials in EAS.

## Over-The-Air Updates

Push updates without app store approval:

```bash
npm run update
```

## Key Features Implementation

### Authentication Flow
- Email/password registration with OTP verification
- Secure login with session management
- Password reset with email verification
- Automatic session persistence
- Role-based routing (admin redirects to admin panel, users to main tabs)

### Order Creation

1. **Direct Order** (from worker profile):
   - Browse workers by category
   - Select a specific worker
   - Fill order details (name, phone, address, description)
   - Attach photos (optional)
   - Submit order
   - Worker receives notification

2. **Broadcast Order** (to multiple workers):
   - Create order from home screen
   - Select multiple categories
   - Fill customer details and requirements
   - Set preferred pricing type (per day/per hour/fixed)
   - Broadcast to all workers in selected categories
   - Workers can view and accept orders

### Real-Time Chat
- Direct messaging between customers and workers
- Order-specific chat threads
- Image sharing in chat
- Message history persistence
- Read receipts and timestamps
- Unread message count with real-time updates
- Chat list with last message preview
- Silent refresh on tab focus

### Worker Upgrade Flow
1. Navigate to Worker Upgrade screen
2. Select subscription duration (1 month, 3 months, 6 months, 1 year)
3. Review pricing and features
4. Proceed to payment screen
5. Submit UPI payment details
6. Enter UTR number
7. Admin reviews and verifies payment
8. Worker rights granted upon approval

### Payment Verification (Admin)
1. Review payment submissions in VerifyWorkers tab
2. Check UTR number and payment details
3. Verify payment amount and date
4. Approve or reject payment
5. Grant worker rights with expiration date

### Admin Dashboard
- **Real-time Metrics**: Total users, active workers, completed orders, revenue
- **User Management**: View, filter, ban/unban users, track payment status
- **Worker Verification**: Review applications, approve/reject, manage subscriptions
- **Order Monitoring**: Track all orders, filter by status, view interactions
- **Issue Resolution**: Handle reports, review complaints, take action
- **Help Center**: Support chat with users, track unread messages
- **Analytics Dashboard**: User growth and engagement metrics

### User Reporting
1. Report problematic users or workers
2. Select report reason (spam, inappropriate, scam, etc.)
3. Add optional description
4. Submit report
5. Admin reviews in Issue tab
6. Admin can ban user or dismiss report

## Database Schema

Refer to `db.txt` for the complete database schema. Key tables include:

- **profiles**: User accounts with role-based access
- **categories**: Service categories
- **worker_profiles**: Worker-specific information
- **worker_subscriptions**: Subscription and payment tracking
- **worker_verification**: Verification document submissions
- **orders**: Service requests and job tracking
- **messages**: Chat messages
- **conversations**: Chat threads
- **ratings**: Reviews and ratings
- **issues**: User reports
- **app_legal_docs**: Legal content (privacy policy, terms)

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues, questions, or contributions, please:
- Open an issue on GitHub
- Contact the development team
- Check the documentation

## Acknowledgments

- Built with [Expo](https://expo.dev)
- Powered by [Supabase](https://supabase.com)
- Icons from [Expo Vector Icons](https://icons.expo.fyi)
- UI inspired by modern mobile design patterns

---

**Version**: 1.0.0  
**Last Updated**: February 2026  
**Maintainer**: Arkusy
