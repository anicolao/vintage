import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('home screen is ready to begin a listing', async ({ page }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Vintage home screen',
    'The SPA restores Firebase auth state and presents the AI-first seller proposition.'
  );

  await page.goto('/');
  await steps.step('home-ready', {
    description: 'The home screen is connected and ready',
    verifications: [
      {
        spec: 'The page exposes the stable Vintage title',
        check: async () => expect(page).toHaveTitle('Vintage — List smarter. Earn more.')
      },
      {
        spec: 'The product promise is visible',
        check: async () => {
          await expect(page.getByRole('heading', { level: 1 })).toHaveText('List smarter.Earn more.');
          await expect(page.getByText('Turn a few photos into a listing written like you, with pricing built for value.')).toBeVisible();
        }
      },
      {
        spec: 'The Google sign-in action becomes available after auth state resolves',
        check: async () => expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled()
      },
      {
        spec: 'The seller-learning promise is complete',
        check: async () => {
          await expect(page.getByText('Your listing style')).toBeVisible();
          await expect(page.getByText('How you describe condition')).toBeVisible();
          await expect(page.getByText('Your pricing approach')).toBeVisible();
        }
      },
      {
        spec: 'The backend readiness status is visible',
        check: async () => expect(page.getByRole('status')).toHaveText('Ready')
      }
    ]
  });

  steps.generateDocs();
});

test('system theme, contrast, touch targets and reduced-transparency fallback', async ({ page, context }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Continue with Google'})).toBeEnabled();
  await expect(page.locator('html')).toHaveCSS('color-scheme',testInfo.project.use.colorScheme!);
  const measurements=await page.evaluate(() => {
    const root=getComputedStyle(document.documentElement);
    const rgb=(hex:string)=>hex.trim().replace('#','').replace(/^(.)(.)(.)$/, '$1$1$2$2$3$3').match(/../g)!.map(v=>parseInt(v,16)/255);
    const lum=(values:number[])=>values.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
    const ratio=(a:string,b:string)=>{const x=lum(rgb(root.getPropertyValue(a)));const y=lum(rgb(root.getPropertyValue(b)));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
    return {
      text: ['--canvas','--surface','--input'].flatMap(bg=>['--text','--muted','--sage','--accent','--error'].map(fg=>ratio(fg,bg))),
      button:ratio('--accent','--on-accent'),
      boundary:ratio('--line','--input'),
      targets:[...document.querySelectorAll('button,a')].map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))
    };
  });
  for(const contrast of measurements.text) expect(contrast).toBeGreaterThanOrEqual(4.5);
  expect(measurements.button).toBeGreaterThanOrEqual(4.5);
  expect(measurements.boundary).toBeGreaterThanOrEqual(3);
  for(const target of measurements.targets){expect(target.height).toBeGreaterThanOrEqual(44);expect(target.width).toBeGreaterThanOrEqual(44);}
  const cdp=await context.newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:testInfo.project.use.colorScheme ?? 'light'},{name:'prefers-reduced-transparency',value:'reduce'},{name:'prefers-reduced-motion',value:'reduce'}]});
  await expect(page.locator('.glass').first()).toHaveCSS('backdrop-filter','none');
  const opaque=await page.locator('.glass').first().evaluate(e=>!getComputedStyle(e).backgroundColor.startsWith('rgba'));
  expect(opaque).toBeTruthy();
});
