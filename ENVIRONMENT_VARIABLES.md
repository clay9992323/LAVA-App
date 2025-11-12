# Environment Variables Setup Guide

## Required Environment Variables

Your application needs these environment variables to connect to the database:

```bash
# SQL Server Database Configuration
DB_SERVER=lovelace-ondemand.sql.azuresynapse.net
DB_DATABASE=SOD
DB_USER=ExternalReadOnly
DB_PASSWORD=your-password-here
DB_PORT=1433

# Application Configuration
NEXT_PUBLIC_APP_NAME=Audience Builder Dashboard
```

---

## Setting Up Environment Variables by Platform

### Vercel (Recommended)

1. **Via Dashboard** (Easiest):
   - Go to https://vercel.com/dashboard
   - Select your project
   - Go to **Settings** → **Environment Variables**
   - Click **Add New**
   - Add each variable:
     - Name: `DB_SERVER`, Value: `lovelace-ondemand.sql.azuresynapse.net`
     - Name: `DB_DATABASE`, Value: `SOD`
     - Name: `DB_USER`, Value: `ExternalReadOnly`
     - Name: `DB_PASSWORD`, Value: (your actual password)
     - Name: `DB_PORT`, Value: `1433`
     - Name: `NEXT_PUBLIC_APP_NAME`, Value: `Audience Builder Dashboard`
   - Click **Save**

2. **Via CLI** (Alternative):
   ```bash
   vercel env add DB_SERVER
   # Enter value when prompted: lovelace-ondemand.sql.azuresynapse.net
   
   vercel env add DB_DATABASE
   # Enter value when prompted: SOD
   
   vercel env add DB_USER
   # Enter value when prompted: ExternalReadOnly
   
   vercel env add DB_PASSWORD
   # Enter value when prompted: (your password)
   
   vercel env add DB_PORT
   # Enter value when prompted: 1433
   
   vercel env add NEXT_PUBLIC_APP_NAME
   # Enter value when prompted: Audience Builder Dashboard
   ```

3. **Redeploy** to apply:
   ```bash
   vercel --prod
   ```

---

### Railway

1. Go to your Railway project dashboard
2. Click **Variables** tab
3. Click **New Variable**
4. Add each variable from the list above
5. Railway will automatically redeploy

---

### Render

1. Go to your web service dashboard
2. Click **Environment** tab
3. Click **Add Environment Variable**
4. Add each variable from the list above
5. Click **Save Changes**
6. Render will automatically redeploy

---

### Firebase Cloud Functions

For Firebase Cloud Functions, you have two options:

#### Option 1: Firebase Functions Config
```bash
firebase functions:config:set \
  db.server="lovelace-ondemand.sql.azuresynapse.net" \
  db.database="SOD" \
  db.user="ExternalReadOnly" \
  db.password="your-password" \
  db.port="1433" \
  app.name="Audience Builder Dashboard"
```

Then in your functions code, access with:
```javascript
const functions = require('firebase-functions');
const dbServer = functions.config().db.server;
```

#### Option 2: Google Secret Manager (Production Recommended)
1. Go to Google Cloud Console
2. Enable Secret Manager API
3. Create secrets for each variable
4. Reference in Cloud Functions

---

## Local Development

For local development, create a `.env.local` file:

```bash
# Copy this to .env.local (not tracked by git)
DB_SERVER=lovelace-ondemand.sql.azuresynapse.net
DB_DATABASE=SOD
DB_USER=ExternalReadOnly
DB_PASSWORD=your-actual-password
DB_PORT=1433
NEXT_PUBLIC_APP_NAME=Audience Builder Dashboard
```

**Never commit `.env.local` to git!** It's already in `.gitignore`.

---

## Verifying Environment Variables

### Vercel
```bash
vercel env ls
```

### Railway
Check the Variables tab in your dashboard

### Render
Check the Environment tab in your dashboard

---

## Security Best Practices

1. ✅ **Never commit passwords to git**
2. ✅ **Use environment variables for all secrets**
3. ✅ **Different credentials for dev/staging/prod**
4. ✅ **Rotate passwords regularly**
5. ✅ **Use read-only database users when possible**
6. ⚠️ **Don't share `.env` files in Slack/email**
7. ⚠️ **Don't screenshot environment variables**

---

## Troubleshooting

### "Database connection failed"
- ✓ Check all variables are set
- ✓ Check for typos in variable names
- ✓ Verify password is correct
- ✓ Ensure database allows connections from your hosting platform
- ✓ Check database firewall rules

### "Environment variable not found"
- ✓ Redeploy after adding variables
- ✓ Check spelling matches exactly (case-sensitive)
- ✓ For `NEXT_PUBLIC_*` variables, rebuild the app

### Variables not updating
- ✓ Redeploy the application
- ✓ Clear build cache (platform-specific)
- ✓ For `NEXT_PUBLIC_*` vars, must rebuild (not just restart)

---

## Quick Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_SERVER` | SQL Server hostname | `lovelace-ondemand.sql.azuresynapse.net` |
| `DB_DATABASE` | Database name | `SOD` |
| `DB_USER` | Database username | `ExternalReadOnly` |
| `DB_PASSWORD` | Database password | (secret) |
| `DB_PORT` | Database port | `1433` |
| `NEXT_PUBLIC_APP_NAME` | Application name | `Audience Builder Dashboard` |

---

## Need Help?

- See `DEPLOYMENT_QUICKSTART.md` for platform-specific deployment guides
- See `FIREBASE_DEPLOYMENT_GUIDE.md` for detailed Firebase setup
- Check your hosting platform's documentation for environment variable setup

