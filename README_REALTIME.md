# Real-Time Billing System - RMK Groups

## ?? Overview
When one person creates a bill, it **instantly appears for all users** (Owner, Admin, Team Members) in real-time. No need to refresh!

## ?? How It Works

### 1. **WebSocket Connection**
- Uses Socket.IO for instant communication
- All users connect to the same real-time workspace
- Automatic reconnection if connection drops

### 2. **User Roles**
- **Owner**: Full access to all features
- **Admin**: Manage billing, customers, invoices  
- **Team Member**: View and create invoices

### 3. **Real-Time Features**
- **Instant Updates**: New bills appear immediately for everyone
- **Live Notifications**: See who created/updated bills
- **User Presence**: See who's currently online
- **Cross-Device**: Works on multiple devices simultaneously

## ?? Getting Started

### 1. **Start the Server**
```bash
npm run dev
```
Server will start on `http://localhost:3000`

### 2. **Choose Your Role**
Open `http://localhost:3000/user_roles.html` to:
- Enter your name
- Select your role (Owner/Admin/Team)
- Join the workspace

### 3. **Open Billing Dashboard**
Go to `http://localhost:3000/admin-billing.html`

### 4. **Test Real-Time Sync**
- Open billing page in **multiple browser tabs**
- Create a bill in one tab
- Watch it **instantly appear** in other tabs!

## ?? Real-Time Events

### When Someone Creates a Bill:
```
? New invoice #QT-2024-001 created by John (Admin)
? Instantly appears for all connected users
? Shows notification: "New invoice created by John"
```

### When Someone Updates a Bill:
```
? Invoice #QT-2024-001 updated by Sarah (Owner)  
? All users see the changes immediately
? Shows notification: "Invoice updated by Sarah"
```

### User Presence:
```
? John (Admin) is now online
? Sarah (Owner) joined the room
? Mike (Team) is now offline
```

## ?? Technical Details

### Server-Side (server.js)
- Socket.IO WebSocket server
- Broadcasts events to all connected users
- Manages user rooms and presence

### Client-Side (realtime.js)
- Auto-connects to WebSocket server
- Detects user role from session
- Handles real-time events and UI updates

### Data Flow:
```
User A creates bill 
  ? Emit 'new-invoice' event
  ? Server broadcasts to all users
  ? User B, C, D receive instantly
  ? UI updates automatically
```

## ?? File Structure

```
rmk-groups/
?? server.js              # WebSocket server
?? realtime.js            # Client real-time manager
?? user_roles.html        # Role selection page
?? admin-billing.js       # Updated with real-time events
?? email_config.js        # Email configuration
```

## ?? Testing Real-Time Features

### 1. **Multiple Users Test**
1. Open `user_roles.html` in 3 different browsers
2. Assign different roles (Owner, Admin, Team)
3. Open billing page in all 3 browsers
4. Create a bill in one browser
5. Watch it appear instantly in others!

### 2. **Notifications Test**
- Create/update bills
- Check toast notifications
- Verify user names appear correctly

### 3. **Connection Test**
- Disconnect internet
- Reconnect and verify auto-reconnection
- Check user presence updates

## ?? Troubleshooting

### **Real-time not working?**
- Check server is running: `npm run dev`
- Verify Socket.IO client loaded in browser console
- Check for WebSocket connection errors

### **Users not seeing updates?**
- Ensure all users are on same network
- Check browser console for errors
- Verify user roles are set correctly

### **Connection issues?**
- Refresh the page
- Check server logs
- Verify firewall isn't blocking WebSockets

## ?? Production Deployment

For production, ensure:
- WebSocket port is open (3000)
- SSL certificate for HTTPS WSS://
- Load balancer supports WebSocket upgrades
- Redis for multi-server scaling

---

**Your RMK Groups billing system now works in real-time across all users! ??**
