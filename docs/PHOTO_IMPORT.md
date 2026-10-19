# iPhone photo import

Choose HEIC/HEIF directly from Photos or the camera picker. The original is saved on the device before background processing and retained unchanged in owned storage. JPEG, PNG and WebP are also accepted. Limits are 8 photos, 50 MB per original, and 60 megapixels. Display/analysis JPEGs are resized to a maximum dimension of 1600 pixels.

The browser tries its native codec first. Otherwise [heic-to 1.6.6](https://github.com/hoppergee/heic-to) decodes in a worker using libheif 1.23.6. The server uses heic-decode with [libheif-js 1.23.5](https://github.com/catdad-experiments/libheif-js). This replaces the former heic2any path. The bundled heic-to notice is served at `/notices/heic-to-LICENSE.txt`; upstream source and build instructions are available at the linked repository.

Progress distinguishes saving locally, preparing the image, waiting for connectivity, uploading original/preview bytes and finishing synchronization. The draft can be queued and navigation remains available during these stages. Original and preview upload percentages share a single byte total, so the bar does not reset halfway through.

Tests cover native-codec selection, worker-codec selection, content detection without trustworthy filename/MIME, malformed media, actual HEIC conversion and reload, orientation, and 48 MP server normalization. These tests do not establish compatibility with every iPhone/iOS capture variant; a failing original should be retained for diagnosis rather than discarded or silently replaced.
