"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SITE_NAME } from "@/lib/site";
import { AccountNav } from "./account/AccountNav";
import { FeedbackNav } from "./FeedbackNav";
import { LogoMark } from "./LogoMark";
import { Wordmark } from "./Wordmark";

export type MenuLink = { href: string; label: string; external?: boolean };

const ITEM = "flex min-h-14 w-full items-center text-left text-lead";

/** Below the sm breakpoint, the header's links move into this menu behind a hamburger button. */
export function MobileMenu({ links }: { links: MenuLink[] }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const close = () => setOpen(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // The menu button is hidden from sm up, so close the menu if the screen widens past it (a phone turned sideways).
  useEffect(() => {
    if (!open) return;
    const wide = window.matchMedia("(min-width: 40rem)");
    const onChange = () => wide.matches && setOpen(false);
    onChange();
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="-mr-2.5 flex size-11 items-center justify-center sm:hidden"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="square" />
        </svg>
      </button>
      <dialog
        ref={dialogRef}
        className="menu"
        aria-label="Menu"
        onClose={close}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="shell pb-4">
          {/* Mirrors the header's row, so the menu reads as the header opening up. */}
          <div className="flex items-center justify-between gap-4 py-4">
            <Link href="/" onClick={close} className="flex items-center gap-2 text-lead" aria-label={`${SITE_NAME}, all jobs`}>
              <LogoMark className="size-[1.3em] shrink-0" />
              <Wordmark />
            </Link>
            <button
              type="button"
              aria-label="Close menu"
              onClick={close}
              className="-mr-2.5 flex size-11 items-center justify-center"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 5l14 14M19 5L5 19" strokeLinecap="square" />
              </svg>
            </button>
          </div>
          <nav aria-label="Site">
            <ul className="divide-y divide-surface-2 border-y border-surface-2">
              {links.map((link) => (
                <li key={link.href}>
                  {link.external ? (
                    <a href={link.href} target="_blank" rel="noopener noreferrer" className={ITEM} onClick={close}>
                      {link.label}
                      <span aria-hidden="true" className="ml-2 text-muted">
                        ↗
                      </span>
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      onClick={close}
                      aria-current={pathname === link.href ? "page" : undefined}
                      className={`${ITEM} aria-[current=page]:font-bold`}
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
              <li>
                <FeedbackNav className={`${ITEM} underline underline-offset-[0.18em]`} onOpen={close} />
              </li>
              <li>
                <AccountNav className={ITEM} onOpen={close} />
              </li>
            </ul>
          </nav>
        </div>
      </dialog>
    </>
  );
}
