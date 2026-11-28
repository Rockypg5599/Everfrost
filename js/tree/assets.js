import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const assetPrefixes = ['./assets/', './public/assets/'];
let prefixPromise;
const ktx2Loaders = new WeakMap();

export function resolveAssetPrefix() {
  if (!prefixPromise) {
    prefixPromise = (async () => {
      for (const prefix of assetPrefixes) {
        try {
          const response = await fetch(new URL(`${prefix}basis/basis_transcoder.js`, document.baseURI), { method: 'HEAD' });
          if (response.ok) return prefix;
        } catch (_) { /* Try the repository-root layout used by raw GitHub Pages. */ }
      }
      return assetPrefixes[0];
    })();
  }
  return prefixPromise;
}

export function assetUrl(prefix, path) {
  return new URL(`${prefix}${path}`, document.baseURI).href;
}

export function getKtx2Loader(prefix, renderer) {
  let loaders = ktx2Loaders.get(renderer);
  if (!loaders) {
    loaders = new Map();
    ktx2Loaders.set(renderer, loaders);
  }
  if (!loaders.has(prefix)) {
    loaders.set(prefix, new KTX2Loader()
      .setTranscoderPath(assetUrl(prefix, 'basis/'))
      .detectSupport(renderer));
  }
  return loaders.get(prefix);
}
