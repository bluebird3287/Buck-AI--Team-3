"""Package the project source into public/buckeyelink-advising-ai.zip.

Runs during the Vercel build (see vercel.json), since serverless functions there
can't run Python or write files at request time the way /api/download-zip does locally.
"""
import os
import zipfile

EXCLUDE_DIRS = {'node_modules', '.git', '.aistudio', '.vercel', 'dist', '.cache', '__pycache__'}
ZIP_NAME = 'buckeyelink-advising-ai.zip'
ZIP_PATH = os.path.join('public', ZIP_NAME)


def is_secret(name: str) -> bool:
    # Keep .env.example, skip every real env file
    return name.startswith('.env') and name != '.env.example'


os.makedirs('public', exist_ok=True)
with zipfile.ZipFile(ZIP_PATH, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for f in files:
            if f == ZIP_NAME or is_secret(f):
                continue
            fp = os.path.join(root, f)
            z.write(fp, os.path.relpath(fp, '.'))

print(f'Wrote {ZIP_PATH}')
