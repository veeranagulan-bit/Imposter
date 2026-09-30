import os
import json
import urllib.request
import urllib.parse
import re
import time

def get_wiki_image_url(topic):
    try:
        search_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(topic)}&utf8=&format=json&srlimit=1"
        req = urllib.request.Request(search_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
        with urllib.request.urlopen(req) as response:
            search_data = json.loads(response.read())
            if not search_data['query']['search']:
                return None
            title = search_data['query']['search'][0]['title']
            
        time.sleep(0.5)
        
        img_url = f"https://en.wikipedia.org/w/api.php?action=query&titles={urllib.parse.quote(title)}&prop=pageimages&format=json&pithumbsize=800"
        req = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
        with urllib.request.urlopen(req) as response:
            img_data = json.loads(response.read())
            pages = img_data['query']['pages']
            page_id = list(pages.keys())[0]
            if 'thumbnail' in pages[page_id]:
                return pages[page_id]['thumbnail']['source']
    except Exception as e:
        print(f"Error fetching wiki for {topic}: {e}")
    return None

server_file = "server.js"
with open(server_file, "r", encoding="utf-8") as f:
    code = f.read()

match = re.search(r'const imageLibrary = \[(.*?)\];', code, re.DOTALL)
if match:
    library_str = match.group(1)
    topics = re.findall(r'topic:\s*"([^"]+)"', library_str)
    related_topics = re.findall(r'relatedTopic:\s*"([^"]+)"', library_str)
    
    for topic in topics:
        # Check if already downloaded and replaced
        if f'url: "/images/{topic.replace(" ", "_")}.jpg"' in code:
            continue
            
        url = get_wiki_image_url(topic)
        if url:
            filename = topic.replace(" ", "_") + ".jpg"
            save_path = os.path.join("public", "images", filename)
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as response, open(save_path, 'wb') as out_file:
                    out_file.write(response.read())
                print(f"Downloaded {topic} -> {filename}")
                pattern = r'(topic:\s*"' + topic + r'",\s*url:\s*)"[^"]+"'
                code = re.sub(pattern, r'\1"/images/' + filename + '"', code)
            except Exception as e:
                print(f"Failed to download {topic}: {e}")
        time.sleep(1)

    for rtopic in related_topics:
        if f'relatedUrl: "/images/{rtopic.replace(" ", "_")}.jpg"' in code:
            continue
            
        url = get_wiki_image_url(rtopic)
        if url:
            filename = rtopic.replace(" ", "_") + ".jpg"
            save_path = os.path.join("public", "images", filename)
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as response, open(save_path, 'wb') as out_file:
                    out_file.write(response.read())
                print(f"Downloaded {rtopic} -> {filename}")
                pattern = r'(relatedTopic:\s*"' + rtopic + r'",\s*relatedUrl:\s*)"[^"]+"'
                code = re.sub(pattern, r'\1"/images/' + filename + '"', code)
            except Exception as e:
                print(f"Failed to download {rtopic}: {e}")
        time.sleep(1)

with open(server_file, "w", encoding="utf-8") as f:
    f.write(code)

print("Finished updating remaining images with real ones.")
