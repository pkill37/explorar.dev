'use client';

export type ScreenshotResult =
  | {
      dataUrl: string;
      error?: never;
    }
  | {
      dataUrl?: never;
      error: string;
    };

export async function captureBugReportScreenshot(): Promise<ScreenshotResult> {
  if (typeof document === 'undefined') {
    return { error: 'Screenshot capture is unavailable during server rendering.' };
  }

  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(document.body, {
      backgroundColor: null,
      logging: false,
      useCORS: true,
      onclone: (clonedDocument) => {
        const style = clonedDocument.createElement('style');
        style.textContent = `
          [data-nextjs-dev-tools],
          [data-nextjs-toast],
          [data-no-screenshot] {
            display: none !important;
          }

          * {
            background-color: transparent !important;
            background-image: none !important;
            border-color: #374151 !important;
            box-shadow: none !important;
            color: #e5e7eb !important;
            outline-color: #60a5fa !important;
            text-decoration-color: #e5e7eb !important;
          }

          body {
            background: #030712 !important;
          }
        `;
        clonedDocument.head.append(style);
      },
      ignoreElements: (element) =>
        element.matches(
          '[data-private], [data-no-screenshot], [data-nextjs-dev-tools], [data-nextjs-toast], input[type="password"]'
        ),
    });

    return {
      dataUrl: canvas.toDataURL('image/png'),
    };
  } catch (error) {
    try {
      return {
        dataUrl: await captureSvgFallbackScreenshot(),
      };
    } catch {
      return {
        error: error instanceof Error ? error.message : 'Screenshot capture failed.',
      };
    }
  }
}

function removePrivateElements(root: HTMLElement): void {
  root
    .querySelectorAll(
      '[data-private], [data-no-screenshot], [data-nextjs-dev-tools], [data-nextjs-toast], script, style, link, input[type="password"]'
    )
    .forEach((element) => element.remove());
}

function encodeSvgDataUrl(svg: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not encode screenshot.'));
      }
    });
    reader.addEventListener('error', () =>
      reject(reader.error ?? new Error('Could not encode screenshot.'))
    );
    reader.readAsDataURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  });
}

async function captureSvgFallbackScreenshot(): Promise<string> {
  const width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  const height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
  const bodyClone = document.body.cloneNode(true);

  if (!(bodyClone instanceof HTMLElement)) {
    throw new Error('Could not clone page for screenshot.');
  }

  removePrivateElements(bodyClone);

  const serializedBody = new XMLSerializer().serializeToString(bodyClone);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml">
      <style>
        * {
          box-sizing: border-box;
          border-color: #374151 !important;
          box-shadow: none !important;
          color: #e5e7eb !important;
          font-family: monospace !important;
          outline-color: #60a5fa !important;
          text-decoration-color: #e5e7eb !important;
        }

        body {
          margin: 0;
        }

        img {
          max-width: 100%;
        }
      </style>
      ${serializedBody}
    </div>
  </foreignObject>
</svg>`.trim();

  return encodeSvgDataUrl(svg);
}
