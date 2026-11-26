import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { navigate } from "gatsby";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { getAuthClient } from "../../lib/auth/client";
import { createAccountClient } from "../../lib/account/client.mjs";
import {
  filterCommands,
  isApplePlatform,
  isPaletteShortcut,
  memberCommands,
  memberSearchPath,
  pageCommands,
  wrapIndex,
} from "../../lib/command-palette.mjs";
import "../../styles/command-palette.scss";

const IDLE_SEARCH = { status: "idle", members: [] };
const FAILED_SEARCH = { status: "error", members: [] };

export default function CommandPalette({ identity }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const toggleOnShortcut = (event) => {
      if (!isPaletteShortcut(event, isApplePlatform(window.navigator))) return;
      event.preventDefault();
      if (!event.repeat) setOpen((value) => !value);
    };
    document.addEventListener("keydown", toggleOnShortcut);
    return () => document.removeEventListener("keydown", toggleOnShortcut);
  }, []);

  return open
    ? createPortal(
        <PaletteDialog identity={identity} onClose={() => setOpen(false)} />,
        document.body,
      )
    : null;
}

function PaletteDialog({ identity, onClose }) {
  const request = useMemo(
    () =>
      createAccountClient({
        getClient: getAuthClient,
        apiURL: process.env.GATSBY_API_URL,
      }),
    [],
  );
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (index) => `${baseId}-option-${index}`;
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [search, setSearch] = useState(IDLE_SEARCH);

  const pages = useMemo(
    () => filterCommands(pageCommands(identity), query),
    [identity, query],
  );
  const searchPath = memberSearchPath(query);
  const members = searchPath ? search.members : [];
  const items = [...pages, ...members];
  const activeIndex = items.length ? Math.min(active, items.length - 1) : -1;

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    if (!searchPath) {
      setSearch(IDLE_SEARCH);
      return undefined;
    }
    setSearch((current) => ({ ...current, status: "loading" }));
    const controller = new AbortController();
    const timer = setTimeout(() => {
      request(searchPath, { userID: identity.id, signal: controller.signal })
        .then((value) => {
          if (controller.signal.aborted) return;
          setSearch({
            status: "done",
            members: memberCommands(value?.members),
          });
        })
        .catch(() => {
          if (!controller.signal.aborted) setSearch(FAILED_SEARCH);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchPath, identity.id, request]);

  useEffect(() => {
    if (activeIndex < 0) return;
    document
      .getElementById(`${baseId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, baseId]);

  function select(item) {
    onClose();
    navigate(item.to);
  }

  function onInputKeyDown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive(wrapIndex(activeIndex + step, items.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0) select(items[activeIndex]);
    }
  }

  function onDialogKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key === "Tab") {
      // The input is the dialog's only focusable element; options are reached
      // with the arrow keys, so Tab must not leave the modal.
      event.preventDefault();
    }
  }

  let status = "";
  if (searchPath && search.status === "loading") status = "Searching members…";
  else if (searchPath && search.status === "error")
    status = "Member search isn't available right now.";
  else if (searchPath && search.status === "done" && members.length === 0)
    status = pages.length ? "No members found." : "No pages or members found.";
  else if (!searchPath && query.trim() && pages.length === 0)
    status = "No pages found.";

  const renderGroup = (label, groupItems, offset) =>
    groupItems.length > 0 && (
      <div role="group" aria-labelledby={`${baseId}-${label}`}>
        <div
          role="presentation"
          id={`${baseId}-${label}`}
          className="csc-command-heading"
        >
          {label}
        </div>
        {groupItems.map((item, groupIndex) => {
          const index = offset + groupIndex;
          return (
            <div
              key={item.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              aria-label={
                item.detail ? `${item.label}, ${item.detail}` : undefined
              }
              className="csc-command-option"
              onMouseMove={() => {
                if (index !== activeIndex) setActive(index);
              }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(item)}
            >
              <span className="csc-command-option-label">{item.label}</span>
              {item.detail && (
                <span className="csc-command-option-detail">{item.detail}</span>
              )}
            </div>
          );
        })}
      </div>
    );

  return (
    <div
      className="csc-command-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="csc-command-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Search the dashboard"
        onKeyDown={onDialogKeyDown}
      >
        <div className="csc-command-field">
          <FontAwesomeIcon icon={faMagnifyingGlass} />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label="Search pages and members"
            aria-autocomplete="list"
            aria-expanded={items.length > 0}
            aria-controls={listId}
            aria-activedescendant={
              activeIndex >= 0 ? optionId(activeIndex) : undefined
            }
            placeholder="Search pages and members"
            autoComplete="off"
            spellCheck={false}
            maxLength={100}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKeyDown}
          />
        </div>
        <div
          id={listId}
          role="listbox"
          aria-label="Results"
          aria-busy={search.status === "loading"}
          className="csc-command-list"
        >
          {renderGroup("Pages", pages, 0)}
          {renderGroup("Members", members, pages.length)}
        </div>
        <p role="status" className="csc-command-status">
          {status}
        </p>
      </div>
    </div>
  );
}
