import pako from 'pako'

const isGzipBytes = (u8) => u8 && u8.length >= 2 && u8[0] === 0x1f && u8[1] === 0x8b

const decodeUtf8 = (u8) => new TextDecoder('utf-8').decode(u8)

const ungzipToText = async (buffer) => {
  const u8 = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer?.buffer || buffer)

  // Prefer native decompression when available; fall back to pako for broad compatibility.
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const decompressedStream = new Response(buffer).body.pipeThrough(new DecompressionStream('gzip'))
      return await new Response(decompressedStream).text()
    } catch (e) {
      // fall through
    }
  }

  return pako.ungzip(u8, { to: 'string' })
}

// Web Worker for parsing large JSON files without blocking the main thread
self.onmessage = async function(e) {
  try {
    let features = []
    let json = null
    
    // Handle string, transferable ArrayBuffer, or already-parsed object.
    if (typeof e.data === 'string') {
      json = JSON.parse(e.data)
    } else if (e.data instanceof ArrayBuffer) {
      const u8 = new Uint8Array(e.data)
      const text = isGzipBytes(u8) ? await ungzipToText(e.data) : decodeUtf8(u8)
      json = JSON.parse(text)
    } else if (e.data && typeof e.data === 'object' && e.data.buffer instanceof ArrayBuffer) {
      const buffer = e.data.buffer
      const gzip = !!e.data.gzip
      const u8 = new Uint8Array(buffer)
      const looksGzip = isGzipBytes(u8)

      if (gzip || looksGzip) {
        // If the caller thinks it's gzip but it doesn't look like gzip bytes,
        // try parsing as plain JSON first (covers servers that auto-decompress).
        if (gzip && !looksGzip) {
          try {
            json = JSON.parse(decodeUtf8(u8))
          } catch (e) {
            const text = await ungzipToText(buffer)
            json = JSON.parse(text)
          }
        } else {
          const text = await ungzipToText(buffer)
          json = JSON.parse(text)
        }
      } else {
        json = JSON.parse(decodeUtf8(u8))
      }
    } else if (e.data && typeof e.data === 'object' && e.data.features) {
      json = e.data
    }

    if (json) {
      features = json.features || []
    }
    
    // Extract only essential properties for map rendering
    const simplified = {
      type: 'FeatureCollection',
      features: features.map(f => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          OBJECTID: f.properties.OBJECTID,
          CrimeCategory: f.properties.CrimeCategory,
          CrimeType: f.properties.CrimeType,
          Crime: f.properties.Crime,
          DATE_OCCU: f.properties.DATE_OCCU,
          MONTH_OCCU_String: f.properties.MONTH_OCCU_String,
          YEAR_OCCU: f.properties.YEAR_OCCU,
          ADDRESS_PUBLIC: f.properties.ADDRESS_PUBLIC,
          DIVISION: f.properties.DIVISION,
          zip: f.properties.zip,
          NEIGHBORHD: f.properties.NEIGHBORHD,
          // Keep full properties for detail view
          _full: f.properties
        }
      }))
    };
    
    self.postMessage({
      type: 'success',
      data: simplified,
      count: features.length
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error.message
    });
  }
};
