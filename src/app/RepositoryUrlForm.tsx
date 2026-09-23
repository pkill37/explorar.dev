'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getCuratedRepoPath, isCuratedRepo } from '@/lib/curated-repos';
import { githubUrlToGitShamanUrl, parseGitHubUrl } from '@/lib/github-url';

const URL_HACK_HOSTS = ['github.com', 'gitlab.com'] as const;

export default function RepositoryUrlForm() {
  const router = useRouter();
  const [githubUrl, setGithubUrl] = useState('');
  const [urlError, setUrlError] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const translatedUrl = githubUrlToGitShamanUrl(githubUrl.trim());
    if (!translatedUrl) {
      setUrlError('Paste a public github.com repository, tree, or file URL.');
      return;
    }

    setUrlError('');
    const target = new URL(translatedUrl);
    const parsedTarget = parseGitHubUrl(githubUrl.trim());
    const destination =
      parsedTarget && isCuratedRepo(parsedTarget.owner, parsedTarget.repo)
        ? `${getCuratedRepoPath(parsedTarget.owner, parsedTarget.repo)}${target.search}`
        : `${target.pathname}${target.search}`;
    router.push(destination);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="shaman-url-input-shell relative min-w-0 flex-1">
          <label htmlFor="github-url" className="sr-only">
            GitHub repository URL
          </label>
          {!githubUrl && (
            <div className="shaman-url-placeholder" aria-hidden="true">
              <span className="shaman-logo-hack">
                <span className="shaman-logo-hack-protocol">https://</span>
                <span className="shaman-logo-hack-hosts">
                  {URL_HACK_HOSTS.map((host) => (
                    <span key={host} className="shaman-logo-hack-old-host">
                      {host}
                    </span>
                  ))}
                  <span className="shaman-logo-hack-new-host">
                    git<span className="shaman-wordmark-sha">sha</span>man
                    <span className="shaman-wordmark-domain">.com</span>
                  </span>
                </span>
                <span className="shaman-logo-hack-path">/owner/repo</span>
              </span>
            </div>
          )}
          <input
            id="github-url"
            value={githubUrl}
            onChange={(event) => setGithubUrl(event.target.value)}
            placeholder=""
            className="shaman-url-input relative z-10 w-full rounded-md px-4 py-4 text-base outline-none"
            type="url"
            inputMode="url"
            autoComplete="url"
          />
        </div>
        <button
          type="submit"
          className="shaman-url-button rounded-md px-6 py-4 text-base font-semibold transition-colors"
        >
          Open in GitShaman
        </button>
      </form>
      {urlError && (
        <p role="alert" className="mt-2 text-xs text-rose-300">
          {urlError}
        </p>
      )}
    </>
  );
}
