import os
import re

files = [
    'about.html', 'achievements.html', 'admin-billing.html', 'admin-customers.html',
    'admin-inventory.html', 'admin-products.html', 'admin-reports.html', 
    'admin-settings.html', 'careers.html', 'clients.html', 'construction.html',
    'contact.html', 'gallery.html', 'index.html', 'services.html'
]

# Header replacement pattern
# Matches the logo-text link containing logo.png img and RMK GROUPS spans
header_pattern = re.compile(r'<a href="index\.html" class="(?:logo-text|logo-brand)"[^>]*>.*?<img src="logo\.png"[^>]*>.*?<span>RMK <span>GROUPS</span></span>.*?</a>', re.DOTALL)
# For the one I modified in index.html which doesn't have the span
header_pattern_index = re.compile(r'<a href="index\.html" class="logo-brand">.*?<img src="logo\.png"[^>]*>.*?</a>', re.DOTALL)

new_header = """<a href="index.html" class="logo-text" style="display: flex; align-items: center; gap: 12px;">
                    <img src="logo.png" alt="RMK Groups" style="height: 60px; width: auto;">
                    <span>RMK <span>GROUPS</span></span>
                </a>"""

# Footer replacement pattern
footer_pattern = re.compile(r'<a href="index\.html" class="logo-text" style="margin-bottom: 2rem; display: block;">.*?RMK <span>GROUPS</span>.*?</a>', re.DOTALL)

new_footer = """<a href="index.html" class="logo-text" style="margin-bottom: 2rem; display: flex; align-items: center; gap: 10px;">
                        <img src="logo.png" alt="RMK Groups" style="height: 50px; width: auto; filter: brightness(0) invert(1);">
                        <span style="color: white;">RMK <span style="color: var(--primary-light);">GROUPS</span></span>
                    </a>"""

for filename in files:
    if not os.path.exists(filename):
        continue
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace header
    content = header_pattern.sub(new_header, content)
    content = header_pattern_index.sub(new_header, content)
    
    # Replace footer
    content = footer_pattern.sub(new_footer, content)
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

print("Batch update completed.")
