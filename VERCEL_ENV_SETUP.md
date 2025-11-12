# Vercel Environment Variables Setup

Your app is deployed at: https://audience-builder-m26o5sljf-clays-projects-a209128b.vercel.app

## Add Environment Variables

1. Go to: https://vercel.com/dashboard
2. Click on **"audience-builder"** project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:

### Required Variables:

```
DB_SERVER = lovelace-ondemand.sql.azuresynapse.net
DB_DATABASE = SOD
DB_USER = ExternalReadOnly
DB_PASSWORD = (your actual password from env.example)
DB_PORT = 1433
NEXT_PUBLIC_APP_NAME = Audience Builder Dashboard
```

### For Each Variable:
1. Click "Add New"
2. Enter variable name
3. Enter value
4. Check ✅ Production (and optionally Preview & Development)
5. Click "Save"

## After Adding Variables

Run this command to redeploy:
```bash
vercel --prod
```

Or just push a new commit and Vercel will auto-deploy.

## Your Deployment URLs

- **Production:** https://audience-builder-m26o5sljf-clays-projects-a209128b.vercel.app
- **Dashboard:** https://vercel.com/clays-projects-a209128b/audience-builder

## Testing

After adding environment variables and redeploying:
1. Visit your production URL
2. The database should connect automatically
3. All filters and data should work!

## Sharing with Coworkers

Just send them the production URL - everything will work!

