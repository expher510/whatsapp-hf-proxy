export default async function handler(req, res) {
  const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;   // n8n Webhook URL
  const WA_TOKEN        = process.env.WA_TOKEN;           // WhatsApp Business API Token
  const WA_PHONE_ID     = process.env.WA_PHONE_ID;        // WhatsApp Phone Number ID
  const VERIFY_TOKEN    = process.env.VERIFY_TOKEN;       // Webhook Verify Token
  const WA_API          = `https://graph.facebook.com/v19.0/${WA_PHONE_ID}`;

  const path = req.url.split("?")[0];

  // ============================================
  // 1️⃣ استقبال من WhatsApp وتوجيهه لـ n8n
  // GET  /api/webhook  → Webhook Verification
  // POST /api/webhook  → رسايل واتساب الجاية
  // ============================================
  if (path === "/api/webhook") {

    // ── Webhook Verification (GET) ──────────────────
    if (req.method === "GET") {
      const mode      = req.query["hub.mode"];
      const token     = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("✅ Webhook verified by Meta");
        return res.status(200).send(challenge);
      }
      return res.status(403).json({ error: "❌ Verification failed" });
    }

    if (req.method !== "POST") {
      return res.status(200).json({ status: "🟢 Webhook endpoint ready" });
    }

    const body = req.body;
    console.log("📨 WhatsApp → n8n:", JSON.stringify(body));

    try {
      const entry   = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value   = changes?.value;
      const message = value?.messages?.[0];

      // ── Status Updates (delivered / read / failed) ──
      if (!message) {
        const status = value?.statuses?.[0];
        if (status) {
          console.log(`📋 Status update: ${status.status} for msg ${status.id}`);
          await fetch(N8N_WEBHOOK_URL, {
            method : "POST",
            headers: { "Content-Type": "application/json" },
            body   : JSON.stringify({
              source    : "whatsapp",
              eventType : "status_update",
              status    : status.status,       // sent / delivered / read / failed
              msgId     : status.id,
              to        : status.recipient_id,
              timestamp : status.timestamp,
              errors    : status.errors || null,
              rawBody   : body,
            }),
            signal: AbortSignal.timeout(55000),
          });
        } else {
          console.log("⚠️ Unknown event type:", JSON.stringify(value));
        }
        return res.status(200).json({ ok: true });
      }

      const from        = message.from;
      const msgId       = message.id;
      const msgType     = message.type;
      const timestamp   = message.timestamp;
      const contactName = value?.contacts?.[0]?.profile?.name || "Unknown";

      console.log(`📱 [${msgType}] from ${contactName} (${from})`);

      // ── Payload موحد لكل أنواع الرسايل ────────────
      const n8nPayload = {
        source      : "whatsapp",
        eventType   : "message",
        from,
        msgId,
        msgType,
        timestamp,
        contactName,

        // ── Text ───────────────────────────────────────
        text        : message?.text?.body || null,

        // ── Media (image/video/audio/document/sticker) ─
        mediaId     : message?.image?.id
                   || message?.video?.id
                   || message?.audio?.id
                   || message?.document?.id
                   || message?.sticker?.id
                   || null,

        mimeType    : message?.image?.mime_type
                   || message?.video?.mime_type
                   || message?.audio?.mime_type
                   || message?.document?.mime_type
                   || message?.sticker?.mime_type
                   || null,

        caption     : message?.image?.caption
                   || message?.video?.caption
                   || message?.document?.caption
                   || null,

        fileName    : message?.document?.filename || null,
        isAnimated  : message?.sticker?.animated  || false,

        // ── Location ───────────────────────────────────
        location    : message?.location
          ? {
              latitude : message.location.latitude,
              longitude: message.location.longitude,
              name     : message.location.name    || null,
              address  : message.location.address || null,
            }
          : null,

        // ── Contacts ───────────────────────────────────
        contacts    : message?.contacts || null,

        // ── Interactive (Button Reply / List Reply) ────
        interactive : message?.interactive
          ? {
              type       : message.interactive.type,
              buttonId   : message.interactive.button_reply?.id          || null,
              buttonTitle: message.interactive.button_reply?.title       || null,
              listId     : message.interactive.list_reply?.id            || null,
              listTitle  : message.interactive.list_reply?.title         || null,
              listDesc   : message.interactive.list_reply?.description   || null,
            }
          : null,

        // ── Button (Quick Reply من Template) ──────────
        button      : message?.button
          ? {
              text   : message.button.text,
              payload: message.button.payload,
            }
          : null,

        // ── Order ──────────────────────────────────────
        order       : message?.order
          ? {
              catalogId   : message.order.catalog_id,
              text        : message.order.text || null,
              productItems: message.order.product_items,
            }
          : null,

        // ── System (تغيير رقم / إضافة لجروب) ──────────
        system      : message?.system
          ? {
              body    : message.system.body,
              type    : message.system.type,
              identity: message.system.identity || null,
              customer: message.system.customer  || null,
            }
          : null,

        // ── Context (رد على رسالة) ─────────────────────
        replyTo     : message?.context
          ? {
              msgId : message.context.id,
              from  : message.context.from,
            }
          : null,

        // ── Referral (جاي من إعلان) ────────────────────
        referral    : message?.referral
          ? {
              sourceUrl : message.referral.source_url,
              sourceType: message.referral.source_type,
              sourceId  : message.referral.source_id,
              headline  : message.referral.headline   || null,
              body      : message.referral.body       || null,
              mediaType : message.referral.media_type || null,
              mediaUrl  : message.referral.media_url  || null,
            }
          : null,

        rawMessage  : message,
      };

      // ── بعت لـ n8n ──────────────────────────────────
      const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify(n8nPayload),
        signal : AbortSignal.timeout(55000),
      });

      const n8nData = await n8nResponse.text();
      console.log(`✅ n8n Response [${n8nResponse.status}]:`, n8nData);

    } catch (err) {
      console.error("❌ Forward to n8n failed:", err.message);
    }

    return res.status(200).json({ ok: true });
  }

  // ============================================
  // 2️⃣ إرسال من n8n لـ WhatsApp
  // POST /api/whatsapp?method=sendText
  // POST /api/whatsapp?method=sendTemplate
  // POST /api/whatsapp?method=sendMedia
  // POST /api/whatsapp?method=sendLocation
  // POST /api/whatsapp?method=sendContacts
  // POST /api/whatsapp?method=sendButtons
  // POST /api/whatsapp?method=sendList
  // POST /api/whatsapp?method=sendCTA
  // POST /api/whatsapp?method=sendReaction
  // POST /api/whatsapp?method=markRead
  // ============================================
  if (path === "/api/whatsapp") {
    if (req.method !== "POST") {
      return res.status(200).json({ status: "🟢 WhatsApp proxy endpoint ready" });
    }

    const method = req.query.method || "sendText";
    const body   = req.body;

    try {
      let waPayload;

      // ── Text ─────────────────────────────────────────
      if (method === "sendText") {
        // body: { to, text, preview_url?, context? }
        waPayload = {
          messaging_product: "whatsapp",
          recipient_type   : "individual",
          to               : body.to,
          type             : "text",
          text             : {
            preview_url: body.preview_url || false,
            body       : body.text,
          },
          ...(body.context && { context: { message_id: body.context } }),
        };

      // ── Template ──────────────────────────────────────
      } else if (method === "sendTemplate") {
        // body: { to, template_name, language_code, components? }
        waPayload = {
          messaging_product: "whatsapp",
          to               : body.to,
          type             : "template",
          template         : {
            name      : body.template_name,
            language  : { code: body.language_code || "ar" },
            components: body.components || [],
          },
        };

      // ── Media (image/video/audio/document/sticker) ────
      } else if (method === "sendMedia") {
        // body: { to, type, link?, media_id?, caption?, filename?, context? }
        waPayload = {
          messaging_product: "whatsapp",
          recipient_type   : "individual",
          to               : body.to,
          type             : body.type,
          [body.type]      : {
            ...(body.link     && { link    : body.link }),
            ...(body.media_id && { id      : body.media_id }),
            ...(body.caption  && { caption : body.caption }),
            ...(body.filename && { filename: body.filename }),
          },
          ...(body.context && { context: { message_id: body.context } }),
        };

      // ── Location ──────────────────────────────────────
      } else if (method === "sendLocation") {
        // body: { to, latitude, longitude, name?, address? }
        waPayload = {
          messaging_product: "whatsapp",
          recipient_type   : "individual",
          to               : body.to,
          type             : "location",
          location         : {
            latitude : body.latitude,
            longitude: body.longitude,
            ...(body.name    && { name   : body.name }),
            ...(body.address && { address: body.address }),
          },
        };

      // ── Contacts ──────────────────────────────────────
      } else if (method === "sendContacts") {
        // body: { to, contacts: [{ name: { first_name, last_name }, phones: [{ phone, type }] }] }
        waPayload = {
          messaging_product: "whatsapp",
          recipient_type   : "individual",
          to               : body.to,
          type             : "contacts",
          contacts         : body.contacts,
        };

      // ── Interactive Buttons ───────────────────────────
      } else if (method === "sendButtons") {
        // body: { to, text, buttons: [{id, title}], header?, footer? }
        waPayload = {
          messaging_product: "whatsapp",
          recipient_type   : "individual",
          to               : body.to,
          type             : "interactive",
          interactive      : {
            type  : "button",
            body  : { text: body.text },
            action: {
              buttons: body.buttons.map(b => ({
                type : "reply",
                reply: { id: b.id, title: b.title },
              })),
            },
            ...(body.header && { header: { type: "text", text: body.header } }),
            ...(body.footer && { footer: { text: body.footer } }),
          },
        };

      // ── Interactive List ──────────────────────────────
      } else if (method === "sendList") {
        // body: { to, text, button_label, sections: [{title, rows: [{id, title, description?}]}], header?, footer? }
        waPayload = {
          messaging_product: "whatsapp",
          recipient_type   : "individual",
          to               : body.to,
          type             : "interactive",
          interactive      : {
            type  : "list",
            body  : { text: body.text },
            action: {
              button  : body.button_label,
              sections: body.sections,
            },
            ...(body.header && { header: { type: "text", text: body.header } }),
            ...(body.footer && { footer: { text: body.footer } }),
          },
        };

      // ── CTA Button (رابط) ─────────────────────────────
      } else if (method === "sendCTA") {
        // body: { to, text, button_text, url, header?, footer? }
        waPayload = {
          messaging_product: "whatsapp",
          recipient_type   : "individual",
          to               : body.to,
          type             : "interactive",
          interactive      : {
            type  : "cta_url",
            body  : { text: body.text },
            action: {
              name      : "cta_url",
              parameters: {
                display_text: body.button_text,
                url         : body.url,
              },
            },
            ...(body.header && { header: { type: "text", text: body.header } }),
            ...(body.footer && { footer: { text: body.footer } }),
          },
        };

      // ── Reaction ──────────────────────────────────────
      } else if (method === "sendReaction") {
        // body: { to, message_id, emoji }
        waPayload = {
          messaging_product: "whatsapp",
          recipient_type   : "individual",
          to               : body.to,
          type             : "reaction",
          reaction         : {
            message_id: body.message_id,
            emoji     : body.emoji,
          },
        };

      // ── Mark as Read ──────────────────────────────────
      } else if (method === "markRead") {
        // body: { message_id }
        waPayload = {
          messaging_product: "whatsapp",
          status            : "read",
          message_id        : body.message_id,
        };

      // ── Fallback ──────────────────────────────────────
      } else {
        waPayload = body;
      }

      console.log(`📤 n8n → WhatsApp [${method}]:`, JSON.stringify(waPayload));

      const waResponse = await fetch(`${WA_API}/messages`, {
        method : "POST",
        headers: {
          "Content-Type" : "application/json",
          "Authorization": `Bearer ${WA_TOKEN}`,
        },
        body: JSON.stringify(waPayload),
      });

      const waData = await waResponse.json();
      console.log("✅ WhatsApp Response:", JSON.stringify(waData));
      return res.status(200).json(waData);

    } catch (err) {
      console.error("❌ Forward to WhatsApp failed:", err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ============================================
  // 3️⃣ تحميل ميديا من WhatsApp وبعتها لـ n8n
  // GET /api/file?media_id=xxxxx
  // ============================================
  if (path === "/api/file") {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed, use GET" });
    }

    const media_id = req.query.media_id;
    if (!media_id) {
      return res.status(400).json({ error: "❌ media_id is required" });
    }

    try {
      console.log(`📥 Downloading media_id: ${media_id}`);

      const getMediaRes  = await fetch(`https://graph.facebook.com/v19.0/${media_id}`, {
        headers: { "Authorization": `Bearer ${WA_TOKEN}` },
      });
      const getMediaData = await getMediaRes.json();

      if (!getMediaData.url) {
        return res.status(400).json({ error: "❌ Failed to get media URL", details: getMediaData });
      }

      const mediaUrl = getMediaData.url;
      const mimeType = getMediaData.mime_type || "application/octet-stream";

      const fileRes = await fetch(mediaUrl, {
        headers: { "Authorization": `Bearer ${WA_TOKEN}` },
      });

      if (!fileRes.ok) {
        return res.status(500).json({ error: "❌ Failed to download media" });
      }

      const extMap = {
        "image/jpeg"     : "jpg",
        "image/png"      : "png",
        "image/webp"     : "webp",
        "image/gif"      : "gif",
        "video/mp4"      : "mp4",
        "video/3gpp"     : "3gp",
        "audio/mpeg"     : "mp3",
        "audio/ogg"      : "ogg",
        "audio/mp4"      : "m4a",
        "audio/amr"      : "amr",
        "audio/aac"      : "aac",
        "application/pdf": "pdf",
        "text/plain"     : "txt",
      };

      const ext        = extMap[mimeType] || "bin";
      const fileName   = `whatsapp_media_${media_id}.${ext}`;
      const fileBuffer = await fileRes.arrayBuffer();

      console.log(`✅ Media downloaded [${mimeType}] size: ${fileBuffer.byteLength} bytes`);

      res.setHeader("Content-Type",        mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("X-Media-Id",          media_id);
      res.setHeader("X-Mime-Type",         mimeType);
      return res.send(Buffer.from(fileBuffer));

    } catch (err) {
      console.error("❌ File proxy error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ============================================
  // 4️⃣ رفع ملف Binary من n8n لـ WhatsApp
  // POST /api/upload?filename=voice.ogg&mimetype=audio/ogg
  // ============================================
  if (path === "/api/upload") {
    if (req.method !== "POST") {
      return res.status(200).json({ status: "🟢 Upload endpoint ready" });
    }

    const filename = req.query.filename || "file";
    const mimetype = req.query.mimetype || "application/octet-stream";

    try {
      console.log(`📤 Uploading media → WhatsApp | file: ${filename} | type: ${mimetype}`);

      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const fileBuffer = Buffer.concat(chunks);

      const formData = new FormData();
      formData.append("messaging_product", "whatsapp");
      formData.append("type",              mimetype);
      formData.append("file",              new Blob([fileBuffer], { type: mimetype }), filename);

      const waResponse = await fetch(`${WA_API}/media`, {
        method : "POST",
        headers: { "Authorization": `Bearer ${WA_TOKEN}` },
        body   : formData,
      });

      const waData = await waResponse.json();
      console.log("✅ WhatsApp Upload Response:", JSON.stringify(waData));
      return res.status(200).json(waData);

    } catch (err) {
      console.error("❌ Upload error:", err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ============================================
  // Health Check
  // ============================================
  return res.status(200).json({
    status        : "🟢 WhatsApp ↔ n8n Proxy is running",
    n8n_webhook   : N8N_WEBHOOK_URL ? "✅ Set" : "❌ Missing",
    wa_token      : WA_TOKEN        ? "✅ Set" : "❌ Missing",
    wa_phone_id   : WA_PHONE_ID     ? "✅ Set" : "❌ Missing",
    verify_token  : VERIFY_TOKEN    ? "✅ Set" : "❌ Missing",
    incoming_types: [
      "text", "image", "video", "audio", "document", "sticker",
      "location", "contacts", "interactive", "button",
      "order", "system", "referral", "status_update"
    ],
    endpoints: {
      webhook_verify: "GET  /api/webhook",
      webhook_receive:"POST /api/webhook",
      sendText      : "POST /api/whatsapp?method=sendText       | { to, text, preview_url?, context? }",
      sendTemplate  : "POST /api/whatsapp?method=sendTemplate   | { to, template_name, language_code, components? }",
      sendMedia     : "POST /api/whatsapp?method=sendMedia      | { to, type, link?, media_id?, caption?, filename? }",
      sendLocation  : "POST /api/whatsapp?method=sendLocation   | { to, latitude, longitude, name?, address? }",
      sendContacts  : "POST /api/whatsapp?method=sendContacts   | { to, contacts: [...] }",
      sendButtons   : "POST /api/whatsapp?method=sendButtons    | { to, text, buttons: [{id,title}], header?, footer? }",
      sendList      : "POST /api/whatsapp?method=sendList       | { to, text, button_label, sections: [...] }",
      sendCTA       : "POST /api/whatsapp?method=sendCTA        | { to, text, button_text, url }",
      sendReaction  : "POST /api/whatsapp?method=sendReaction   | { to, message_id, emoji }",
      markRead      : "POST /api/whatsapp?method=markRead       | { message_id }",
      downloadMedia : "GET  /api/file?media_id=xxx",
      uploadMedia   : "POST /api/upload?filename=voice.ogg&mimetype=audio/ogg",
    },
  });
}