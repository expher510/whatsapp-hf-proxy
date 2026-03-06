# WhatsApp ↔ n8n Proxy

بوابة وسيطة بين **WhatsApp Business API** و **n8n** مبنية على **Vercel**.

```
WhatsApp  ←──────────────────────→  Vercel Proxy  ←──────────────────────→  n8n
```

---

## 📦 المتغيرات المطلوبة

حطهم في Vercel → Settings → Environment Variables

| المتغير | الوصف |
|---|---|
| `N8N_WEBHOOK_URL` | رابط الـ Webhook بتاع n8n |
| `WA_TOKEN` | Access Token من Meta Developer Dashboard |
| `WA_PHONE_ID` | Phone Number ID من Meta Developer Dashboard |
| `VERIFY_TOKEN` | كلمة سر بتختارها انت للـ Webhook Verification |

---

## 🔗 Base URL

```
https://your-app.vercel.app
```

---

## 📡 Endpoints

---

### ✅ Health Check
تأكد إن الـ proxy شغال وكل المتغيرات متحطة

```
GET https://your-app.vercel.app/
```

**Response:**
```json
{
  "status": "🟢 WhatsApp ↔ n8n Proxy is running",
  "n8n_webhook": "✅ Set",
  "wa_token": "✅ Set",
  "wa_phone_id": "✅ Set",
  "verify_token": "✅ Set"
}
```

---

## 1️⃣ Webhook — استقبال رسايل من WhatsApp

---

### Webhook Verification
Meta بتبعته مرة واحدة بس وقت التسجيل

```
GET https://your-app.vercel.app/api/webhook
```

حط الـ URL ده في Meta Developer Dashboard ← WhatsApp ← Configuration ← Webhook

---

### استقبال الرسايل
كل رسالة جاية من واتساب بتتبعت لـ n8n تلقائياً

```
POST https://your-app.vercel.app/api/webhook
```

الـ Payload اللي بيوصل لـ n8n بيكون فيه:

| الحقل | الوصف |
|---|---|
| `source` | دايمًا `"whatsapp"` |
| `eventType` | `"message"` أو `"status_update"` |
| `from` | رقم المرسل |
| `msgId` | ID الرسالة |
| `msgType` | نوع الرسالة (شوف الجدول تحت) |
| `timestamp` | وقت الرسالة |
| `contactName` | اسم المرسل |

#### أنواع الرسايل اللي بتتستقبل `msgType`

| النوع | الوصف | الحقول الإضافية |
|---|---|---|
| `text` | رسالة نصية | `text` |
| `image` | صورة | `mediaId`, `mimeType`, `caption` |
| `video` | فيديو | `mediaId`, `mimeType`, `caption` |
| `audio` | صوت / voice note | `mediaId`, `mimeType` |
| `document` | ملف | `mediaId`, `mimeType`, `fileName` |
| `sticker` | ستيكر | `mediaId`, `mimeType`, `isAnimated` |
| `location` | موقع | `location.latitude`, `location.longitude`, `location.name`, `location.address` |
| `contacts` | جهة اتصال | `contacts` |
| `interactive` | رد على Button أو List | `interactive.type`, `interactive.buttonId`, `interactive.listId` |
| `button` | رد على Quick Reply Template | `button.text`, `button.payload` |
| `order` | طلب شراء | `order.catalogId`, `order.productItems` |
| `system` | تغيير رقم / إضافة لجروب | `system.type`, `system.body` |
| `referral` | جاي من إعلان | `referral.sourceUrl`, `referral.headline` |
| `status_update` | delivered / read / failed | `status`, `msgId`, `to` |

---

## 2️⃣ إرسال رسايل من n8n لـ WhatsApp

كل الـ endpoints دي بتتبعت من n8n لـ Vercel وبيوصّلها لواتساب

---

### 📝 إرسال نص
```
POST https://your-app.vercel.app/api/whatsapp?method=sendText
```
```json
{
  "to": "201234567890",
  "text": "مرحبا! كيف أقدر أساعدك؟",
  "preview_url": false,
  "context": "msg_id_للرد_عليه"
}
```
> `context` اختياري — لو حطيته الرسالة هتبقى رد على رسالة معينة

---

### 📋 إرسال Template
```
POST https://your-app.vercel.app/api/whatsapp?method=sendTemplate
```
```json
{
  "to": "201234567890",
  "template_name": "hello_world",
  "language_code": "ar",
  "components": []
}
```

---

### 🖼️ إرسال ميديا (صورة / فيديو / صوت / ملف)
```
POST https://your-app.vercel.app/api/whatsapp?method=sendMedia
```
```json
{
  "to": "201234567890",
  "type": "image",
  "link": "https://example.com/image.jpg",
  "caption": "شوف الصورة دي"
}
```
أو بـ `media_id` لو رفعت الملف قبل كده:
```json
{
  "to": "201234567890",
  "type": "document",
  "media_id": "1234567890",
  "filename": "report.pdf",
  "caption": "التقرير الشهري"
}
```
> قيم `type` المتاحة: `image` | `video` | `audio` | `document` | `sticker`

---

### 📍 إرسال موقع
```
POST https://your-app.vercel.app/api/whatsapp?method=sendLocation
```
```json
{
  "to": "201234567890",
  "latitude": 30.0444,
  "longitude": 31.2357,
  "name": "القاهرة",
  "address": "ميدان التحرير، القاهرة"
}
```

---

### 👤 إرسال جهة اتصال
```
POST https://your-app.vercel.app/api/whatsapp?method=sendContacts
```
```json
{
  "to": "201234567890",
  "contacts": [
    {
      "name": {
        "first_name": "أحمد",
        "last_name": "محمد"
      },
      "phones": [
        { "phone": "+201234567890", "type": "MOBILE" }
      ]
    }
  ]
}
```

---

### 🔘 إرسال أزرار تفاعلية (Buttons)
```
POST https://your-app.vercel.app/api/whatsapp?method=sendButtons
```
```json
{
  "to": "201234567890",
  "header": "اختار خدمة",
  "text": "إيه اللي تحب تعمله؟",
  "footer": "اضغط على زرار",
  "buttons": [
    { "id": "btn_1", "title": "تتبع الطلب" },
    { "id": "btn_2", "title": "التحدث مع موظف" },
    { "id": "btn_3", "title": "إلغاء الطلب" }
  ]
}
```
> أقصى عدد أزرار: **3**

---

### 📋 إرسال قايمة اختيارات (List)
```
POST https://your-app.vercel.app/api/whatsapp?method=sendList
```
```json
{
  "to": "201234567890",
  "header": "قايمة الخدمات",
  "text": "اختار الخدمة اللي تحتاجها",
  "footer": "خدمة العملاء",
  "button_label": "اعرض الخدمات",
  "sections": [
    {
      "title": "الدعم الفني",
      "rows": [
        { "id": "row_1", "title": "مشكلة تقنية", "description": "مساعدة في مشاكل تقنية" },
        { "id": "row_2", "title": "إعادة تعيين كلمة المرور" }
      ]
    },
    {
      "title": "المبيعات",
      "rows": [
        { "id": "row_3", "title": "استفسار عن منتج" },
        { "id": "row_4", "title": "تتبع طلب" }
      ]
    }
  ]
}
```

---

### 🔗 إرسال زرار رابط (CTA)
```
POST https://your-app.vercel.app/api/whatsapp?method=sendCTA
```
```json
{
  "to": "201234567890",
  "header": "موقعنا",
  "text": "زور موقعنا للمزيد من المعلومات",
  "footer": "متاح 24/7",
  "button_text": "افتح الموقع",
  "url": "https://example.com"
}
```

---

### 😍 إرسال Reaction
```
POST https://your-app.vercel.app/api/whatsapp?method=sendReaction
```
```json
{
  "to": "201234567890",
  "message_id": "wamid.xxx",
  "emoji": "👍"
}
```

---

### ✔️ Mark as Read
```
POST https://your-app.vercel.app/api/whatsapp?method=markRead
```
```json
{
  "message_id": "wamid.xxx"
}
```

---

## 3️⃣ تحميل ميديا من WhatsApp

لما يوصلك `mediaId` في رسالة، استخدم الـ endpoint ده تحمّل الملف

```
GET https://your-app.vercel.app/api/file?media_id=MEDIA_ID
```

**مثال:**
```
GET https://your-app.vercel.app/api/file?media_id=1234567890
```

**Response:** الملف نفسه (صورة / صوت / فيديو / PDF) مع الـ headers:

| Header | الوصف |
|---|---|
| `Content-Type` | نوع الملف مثلاً `image/jpeg` |
| `X-Media-Id` | الـ media_id |
| `X-Mime-Type` | الـ mime type |

---

## 4️⃣ رفع ميديا لـ WhatsApp

ارفع ملف لـ WhatsApp واحصل على `media_id` تبعته في رسالة

```
POST https://your-app.vercel.app/api/upload?filename=voice.ogg&mimetype=audio/ogg
```

**Body:** الملف Binary مباشرة

**Response:**
```json
{
  "id": "1234567890"
}
```
استخدم الـ `id` ده في `sendMedia` مع `media_id`

---

## 🗂️ ملخص كل الـ Endpoints

| الـ Endpoint | Method | الوصف |
|---|---|---|
| `/` | GET | Health Check |
| `/api/webhook` | GET | Webhook Verification |
| `/api/webhook` | POST | استقبال رسايل من WhatsApp |
| `/api/whatsapp?method=sendText` | POST | إرسال نص |
| `/api/whatsapp?method=sendTemplate` | POST | إرسال Template |
| `/api/whatsapp?method=sendMedia` | POST | إرسال صورة/فيديو/صوت/ملف |
| `/api/whatsapp?method=sendLocation` | POST | إرسال موقع |
| `/api/whatsapp?method=sendContacts` | POST | إرسال جهة اتصال |
| `/api/whatsapp?method=sendButtons` | POST | إرسال أزرار تفاعلية |
| `/api/whatsapp?method=sendList` | POST | إرسال قايمة اختيارات |
| `/api/whatsapp?method=sendCTA` | POST | إرسال زرار رابط |
| `/api/whatsapp?method=sendReaction` | POST | إرسال Reaction |
| `/api/whatsapp?method=markRead` | POST | Mark as Read |
| `/api/file?media_id=xxx` | GET | تحميل ميديا من WhatsApp |
| `/api/upload` | POST | رفع ميديا لـ WhatsApp |
#   w h a t s a p p - h f - p r o x y  
 