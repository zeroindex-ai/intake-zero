Favicon assets to add before first deploy (see feedback_favicon_real_files_for_new_sites):

  apple-touch-icon.png     180x180
  icon-192.png             192x192
  icon-512.png             512x512
  manifest.webmanifest     points at icon-192/icon-512
  og-image.png             1200x630, rendered from og-image.svg via:
    /Applications/Inkscape.app/Contents/MacOS/inkscape og-image.svg \
      --export-type=png --export-width=1200 --export-filename=og-image.png

favicon.ico (must contain 16/32/48/64 frames) goes in /app, not here — Next 16
intercepts /favicon.ico via app/favicon.ico per feedback_nextjs_favicon_app_dir.
