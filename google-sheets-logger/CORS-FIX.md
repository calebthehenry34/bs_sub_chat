# 🚨 CORS ERROR FIX - Quick Guide

If you're seeing this error in your browser console:

```
Access to fetch at 'https://script.google.com/...' has been blocked by CORS policy
```

**Don't worry - this is an easy fix!** Follow these steps:

---

## ✅ Step-by-Step Fix (2 minutes)

### Step 1: Open Your Apps Script

1. Go to your Google Sheet with the chat logs
2. Click **Extensions** → **Apps Script**

### Step 2: Update the Code

1. In the Apps Script editor, **select all the code** (Ctrl/Cmd + A)
2. **Delete it all**
3. Open the file `google-sheets-logger/google-apps-script.js` from this repository
4. **Copy all the code** from that file
5. **Paste it** into the Apps Script editor
6. Click **Save** (💾 icon or Ctrl/Cmd + S)

### Step 3: Redeploy

This is the most important step!

1. In the Apps Script editor, click **Deploy** (top right)
2. Click **Manage deployments**
3. You'll see your existing deployment listed
4. Click the **pencil icon** ✏️ (Edit) next to it
5. Under **Version**, click the dropdown and select **"New version"**
6. Click **Deploy**
7. Click **Done**

### Step 4: Clear Browser Cache & Test

1. Go to your Shopify store
2. Press **Ctrl/Cmd + Shift + R** (hard refresh)
3. Press **F12** to open DevTools
4. Go to **Console** tab
5. Send a test chat message
6. The CORS error should be GONE! ✅

---

## 🎯 What Changed?

The updated script now includes:

**New `doOptions()` function:**
```javascript
function doOptions(e) {
  return createCorsResponse();
}
```

This handles the browser's "preflight" request that checks if cross-origin requests are allowed.

**CORS Headers on all responses:**
```javascript
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type
Access-Control-Allow-Methods: GET, POST, OPTIONS
```

These headers tell the browser "it's okay to make requests from any domain."

---

## 🔍 How to Verify It's Fixed

### Before Fix:
```
❌ POST https://script.google.com/.../exec net::ERR_FAILED
❌ CORS policy error
❌ No logs in Google Sheet
```

### After Fix:
```
✅ POST https://script.google.com/.../exec 200 OK
✅ No CORS errors
✅ Logs appear in Google Sheet
```

---

## ⚠️ Common Mistakes

### Mistake 1: Not Redeploying
**Problem:** You updated the code but didn't redeploy
**Solution:** You MUST redeploy with a "New version" for changes to take effect

### Mistake 2: Using Old Version
**Problem:** You redeployed but selected the old version
**Solution:** Make sure to select "New version" when redeploying

### Mistake 3: Browser Cache
**Problem:** Browser is still using cached responses
**Solution:** Do a hard refresh (Ctrl/Cmd + Shift + R)

---

## 🆘 Still Not Working?

### Check 1: Deployment Status
1. Go to **Deploy** → **Manage deployments**
2. Make sure deployment shows as "Active"
3. Note the version number (should be v2 or higher if you redeployed)

### Check 2: Test Directly
Run this in Terminal:

```bash
curl -X OPTIONS 'YOUR_WEB_APP_URL' -v
```

You should see these headers in the response:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

If you don't see these headers, the deployment didn't update properly. Try redeploying again.

### Check 3: Wait a Few Minutes
Sometimes Google's servers take 2-3 minutes to fully update. Wait a bit and try again.

---

## 📝 Quick Checklist

- [ ] Opened Apps Script editor
- [ ] Replaced ALL code with updated version
- [ ] Saved the script
- [ ] Clicked Deploy → Manage deployments
- [ ] Clicked Edit (pencil icon)
- [ ] Selected "New version"
- [ ] Clicked Deploy
- [ ] Hard refreshed browser (Ctrl/Cmd + Shift + R)
- [ ] Tested chat - no CORS error
- [ ] Logs appearing in Google Sheet

---

## 🎉 Success!

Once the CORS error is gone, your chat logs will flow seamlessly to Google Sheets!

**Questions?** Check the full troubleshooting guide in `SETUP.md`
