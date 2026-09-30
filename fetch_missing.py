import os
import json
import urllib.request
import urllib.parse
import re
import time

missing_topics = ["Basketball", "Teapot", "Rose", "Desktop Computer", "Statue of Liberty", "Sunflower"]

def get_wiki_image_url(topic):
    try:
        search_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(topic)}&utf8=&format=json&srlimit=1"
        req = urllib.request.Request(search_url, headers={'User-Agent': 'ImposterInkBot/1.0 (test@example.com)'})
        with urllib.request.urlopen(req) as response:
            search_data = json.loads(response.read())
            if not search_data['query']['search']:
                return None
            title = search_data['query']['search'][0]['title']
            
        time.sleep(2)
        
        img_url = f"https://en.wikipedia.org/w/api.php?action=query&titles={urllib.parse.quote(title)}&prop=pageimages&format=json&pithumbsize=800"
        req = urllib.request.Request(img_url, headers={'User-Agent': 'ImposterInkBot/1.0 (test@example.com)'})
        with urllib.request.urlopen(req) as response:
            img_data = json.loads(response.read())
            pages = img_data['query']['pages']
            page_id = list(pages.keys())[0]
            if 'thumbnail' in pages[page_id]:
                return pages[page_id]['thumbnail']['source']
    except Exception as e:
        print(f"Error fetching wiki for {topic}: {e}")
    return None

for topic in missing_topics:
    url = get_wiki_image_url(topic)
    if url:
        filename = topic.replace(" ", "_") + ".jpg"
        save_path = os.path.join("public", "images", filename)
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response, open(save_path, 'wb') as out_file:
                out_file.write(response.read())
            print(f"Downloaded {topic} -> {filename}")
        except Exception as e:
            print(f"Failed to download {topic}: {e}")
    time.sleep(2)
