import { expect, type Page, type TestInfo } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface Verification {
  spec: string;
  check: () => Promise<void>;
}

interface DocStep {
  title: string;
  image: string;
  specs: string[];
}

export class TestStepHelper {
  private count = 0;
  private steps: DocStep[] = [];
  private title = '';
  private description = '';

  constructor(private page: Page, private testInfo: TestInfo) {}

  setMetadata(title: string, description: string) {
    this.title = title;
    this.description = description;
  }

  async step(id: string, options: { description: string; verifications: Verification[] }) {
    for (const verification of options.verifications) await verification.check();
    await expect(this.page.locator('[data-status]')).toHaveAttribute('data-status', 'ready');
    await this.page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map((image) => image.complete ? undefined : image.decode())
      );
      const root = document.documentElement;
      if (root.scrollWidth > window.innerWidth + 1) {
        throw new Error(`page width ${root.scrollWidth} exceeds viewport ${window.innerWidth}`);
      }
    });
    await this.page.mouse.move(0, 0);

    const index = String(this.count++).padStart(3, '0');
    const filename = `${index}-${id}-${this.testInfo.project.name}-linux.png`;
    await expect(this.page).toHaveScreenshot(filename, { maxDiffPixels: 0 });
    this.steps.push({
      title: options.description,
      image: `./screenshots/${filename}`,
      specs: options.verifications.map(({ spec }) => spec)
    });
  }

  generateDocs() {
    if (this.testInfo.project.name !== 'desktop') return;
    let content = `# ${this.title}\n\n${this.description}\n\n`;
    for (const step of this.steps) {
      content += `## ${step.title}\n\n![${step.title}](${step.image})\n\n`;
      content += `**Verifications:**\n\n${step.specs.map((spec) => `- [x] ${spec}`).join('\n')}\n\n`;
    }
    fs.writeFileSync(path.join(path.dirname(this.testInfo.file), 'README.md'), `${content.trimEnd()}\n`);
  }
}
