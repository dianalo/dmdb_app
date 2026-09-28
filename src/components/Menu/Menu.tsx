import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './Menu.module.css';

export interface MenuItem {
  id: string;
  label: string;
  onSelect(): void;
  /** Rote Schrift für Aktionen, die Daten löschen. */
  danger?: boolean;
  disabled?: boolean;
}

export interface MenuProps {
  /** Zugänglicher Name des Buttons, z. B. «Datenbank-Aktionen». */
  label: string;
  /** Inhalt des Buttons (Icon oder Text). */
  children: ReactNode;
  items: MenuItem[];
  buttonClassName?: string;
  /** Rechtsbündig unter dem Button statt linksbündig. */
  align?: 'start' | 'end';
}

const MARGIN = 8;

/**
 * Button mit Aufklappmenü (`role="menu"`). Öffnet per Tipp oder Klick, schliesst
 * bei Escape, Tipp daneben oder Auswahl; Pfeiltasten wandern durch die Einträge.
 * Das Menü hängt am `<body>`, damit es nicht von scrollenden Containern oder dem
 * Drawer (transform) abgeschnitten wird.
 */
export function Menu({ label, children, items, buttonClassName, align = 'start' }: MenuProps) {
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const enabledItems = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ??
        [],
    );

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    setPosition(null);
    if (restoreFocus) buttonRef.current?.focus();
  };

  // Position innerhalb des Viewports; passt das Menü unten nicht hin, klappt es nach oben.
  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const menu = menuRef.current;
    if (!button || !menu) return;
    const anchor = button.getBoundingClientRect();
    const { width, height } = menu.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    let left = align === 'end' ? anchor.right - width : anchor.left;
    left = Math.max(MARGIN, Math.min(left, vw - width - MARGIN));
    let top = anchor.bottom + 4;
    if (top + height > vh - MARGIN && anchor.top - height - 4 >= MARGIN) {
      top = anchor.top - height - 4;
    }
    top = Math.max(MARGIN, Math.min(top, vh - height - MARGIN));
    setPosition({ top, left });
  }, [open, align]);

  // Nach dem Positionieren den ersten Eintrag fokussieren.
  useEffect(() => {
    if (open && position) enabledItems()[0]?.focus();
  }, [open, position]);

  // Tipp daneben, Grössenänderung und Scrollen schliessen das Menü.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close(false);
    };
    const onScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      close(false);
    };
    const onResize = () => close(false);
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const list = enabledItems();
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (next: number) => list[(next + list.length) % list.length]?.focus();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusAt(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusAt(list.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        close(true);
        break;
      case 'Tab':
        close(false);
        break;
    }
  };

  const onButtonKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={buttonClassName}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={onButtonKeyDown}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            className={styles.menu}
            style={
              position
                ? { top: position.top, left: position.left }
                : { top: 0, left: 0, visibility: 'hidden' }
            }
            onKeyDown={onMenuKeyDown}
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={styles.item}
                data-danger={item.danger || undefined}
                disabled={item.disabled}
                onClick={() => {
                  close(true);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
