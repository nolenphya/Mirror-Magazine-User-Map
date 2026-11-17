export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const formData = await request.formData();
      const photoFile = formData.get("photoFile");

      if (!photoFile) {
        return new Response(JSON.stringify({ error: "No photo file provided." }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 1. Convert uploaded file to base64 for GitHub API
      const arrayBuffer = await photoFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < uint8Array.byteLength; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64Content = btoa(binary);

      // 2. Commit file to GitHub repository
      const cleanFileName = photoFile.name.replace(/[^a-zA-Z0-9._-]/g, "");
      const filePath = `uploads/archive_${Date.now()}_${cleanFileName}`;
      const githubApiUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${filePath}`;

      const githubRes = await fetch(githubApiUrl, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${env.GITHUB_PAT}`,
          "User-Agent": "Cloudflare-Worker-Archive",
          "Accept": "application/vnd.github+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `Add archive photo: ${cleanFileName}`,
          content: base64Content,
          branch: env.GITHUB_BRANCH || "main"
        })
      });

      if (!githubRes.ok) {
        const errJson = await githubRes.json();
        throw new Error(`GitHub API Error: ${errJson.message || githubRes.statusText}`);
      }

      // Construct public raw URL for Airtable
      const publicPhotoUrl = `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${env.GITHUB_BRANCH || "main"}/${filePath}`;

      // 3. Send record payload to Airtable
      const airtablePayload = {
        fields: {
          Name: formData.get("name") || "",
          Caption: formData.get("caption") || "",
          Description: formData.get("description") || "",
          Camera: formData.get("camera") || "",
          Film: formData.get("film") || "",
          Street: formData.get("street") || "",
          Unit: formData.get("unit") || "",
          Borough: formData.get("borough") || "",
          State: formData.get("state") || "",
          ZipCode: formData.get("zipCode") || "",
          Latitude: parseFloat(formData.get("latitude")) || null,
          Longitude: parseFloat(formData.get("longitude")) || null,
          Approved: false, // Default to moderation queue
          "Photo File": [{ url: publicPhotoUrl }]
        }
      };

      const airtableUrl = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE_NAME)}`;
      const airtableRes = await fetch(airtableUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.AIRTABLE_PAT}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(airtablePayload)
      });

      if (!airtableRes.ok) {
        const errorText = await airtableRes.text();
        throw new Error(`Airtable API Error: ${errorText}`);
      }

      const airtableResult = await airtableRes.json();

      return new Response(JSON.stringify({ success: true, record: airtableResult }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });

    } catch (err) {
      console.error("Worker Error:", err);
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  },
};