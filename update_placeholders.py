import re

file_path = "c:/Users/Admin/Desktop/New folder/User Journey/DCM/DCM.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add our new image-dropzone CSS right below img-placeholder CSS
css_to_add = """
      /* ─── Simplified Image Dropzone ─── */
      .image-dropzone {
        width: 100%;
        min-height: 120px;
        border: 1.5px dashed #b8cdd9;
        border-radius: 10px;
        background: linear-gradient(135deg, #f4f9fc 0%, #eef5f9 100%);
        margin-top: 8px;
        position: relative;
        overflow: hidden;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .image-dropzone::before {
        content: "";
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(14, 116, 144, 0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(14, 116, 144, 0.04) 1px, transparent 1px);
        background-size: 12px 12px;
        z-index: 0;
      }

      .image-dropzone img {
        width: 100%;
        height: auto;
        max-width: 100%;
        display: block;
        object-fit: contain;
        position: relative;
        z-index: 1;
        border-radius: 10px;
      }
"""

if ".image-dropzone {" not in content:
    content = content.replace("/* ─── Image Placeholder ─── */", css_to_add + "\n      /* ─── Image Placeholder ─── */")

# We want to find <div class="img-placeholder ..."> and replace the entire block (including nested divs)
# with <div class="image-dropzone"></div>
# For dual placeholders, the user might want to keep the styling, so let's keep the dual layout intact if possible,
# But wait, the user said "do same in all image placeholder provide a classname with specific css where i will put the image also remove everything from inside"
# I will just replace <div class="img-placeholder[*]">...</div> with <div class="image-dropzone"></div>

def replace_placeholders(text):
    result = []
    i = 0
    search_str = '<div class="img-placeholder'
    search_str2 = '<div class="img-placeholder\n'
    
    while i < len(text):
        idx1 = text.find(search_str, i)
        idx2 = text.find('<div\n            class="img-placeholder', i)
        
        idx = -1
        if idx1 != -1 and idx2 != -1:
            idx = min(idx1, idx2)
        elif idx1 != -1:
            idx = idx1
        elif idx2 != -1:
            idx = idx2
            
        if idx == -1:
            result.append(text[i:])
            break
            
        result.append(text[i:idx])
        
        # We start parsing nested divs from idx
        div_count = 0
        j = idx
        while j < len(text):
            if text.startswith('<div', j):
                div_count += 1
                j += 4
            elif text.startswith('</div', j):
                div_count -= 1
                j += 5
                if div_count == 0:
                    # found the end of the img-placeholder block
                    # skip to the closing '>'
                    while j < len(text) and text[j] != '>':
                        j += 1
                    j += 1 # skip '>'
                    break
            else:
                j += 1
        
        # Replace the whole block with the new class
        result.append('          <div class="image-dropzone">\n            <!-- Add your <img> tag here -->\n          </div>')
        i = j
        
    return "".join(result)

new_content = replace_placeholders(content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Placeholders replaced!")
