import adapter from '@sveltejs/adapter-static';

const config = {
  kit: {
    adapter: adapter({ fallback: 'index.html' }),
    paths: {
      base: process.env.PUBLIC_BASE_PATH ?? ''
    }
  }
};

export default config;
