import os
import urllib.request
import re

server_file = "server.js"
with open(server_file, "r", encoding="utf-8") as f:
    code = f.read()

urls = re.findall(r'url:\s*"(https://upload\.wikimedia\.org/.*?)"', code)
related_urls = re.findall(r'relatedUrl:\s*"(https://upload\.wikimedia\.org/.*?)"', code)

all_urls = list(set(urls + related_urls))

for i, url in enumerate(all_urls):
    filename = f"image_{i}.jpg"
    save_path = os.path.join("public", "images", filename)
    picsum_url = f"https://picsum.photos/seed/{i}/800/600"
    print(f"Downloading {filename}...")
    try:
        req = urllib.request.Request(picsum_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response, open(save_path, 'wb') as out_file:
            out_file.write(response.read())
        
        # Replace the URL in the server.js code
        code = code.replace(url, f"/images/{filename}")
    except Exception as e:
        print(f"Failed to download {url}: {e}")

with open(server_file, "w", encoding="utf-8") as f:
    f.write(code)

print("Finished downloading and updating server.js")
