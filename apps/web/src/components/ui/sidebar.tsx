"use client";

import { cn } from "@/lib/utils";
import Link, { LinkProps } from "next/link";
import React, { useState, createContext, useContext, useRef, useEffect } from "react";
import gsap from "gsap";
import { Menu, X } from "lucide-react";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props: React.ComponentProps<"div">) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...props} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, animate } = useSidebar();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !animate) return;
    const width = open ? 250 : 80;
    gsap.to(el, { width, duration: 0.25, ease: "power2.inOut" });
  }, [open, animate]);

  return (
    <div
      ref={ref}
      className={cn(
        "h-screen px-4 py-4 hidden md:flex md:flex-col bg-[var(--dark-bg)] border-r border-[var(--dark-border)] flex-shrink-0 fixed left-0 top-0 z-20",
        className
      )}
      style={{ width: animate ? (open ? 250 : 80) : 250 }}
      {...props}
    >
      {children}
    </div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();
  const ref = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(open);
  const isExitingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      isExitingRef.current = false;
      const el = ref.current;
      if (el) {
        gsap.killTweensOf(el);
        gsap.fromTo(el, { x: "-100%", opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: "power2.inOut", clearProps: "all" });
      }
    } else if (shouldRender && !isExitingRef.current) {
      isExitingRef.current = true;
      const el = ref.current;
      if (!el) {
        setShouldRender(false);
        return;
      }
      gsap.killTweensOf(el);
      gsap.to(el, {
        x: "-100%",
        opacity: 0,
        duration: 0.3,
        ease: "power2.inOut",
        onComplete: () => {
          setShouldRender(false);
          isExitingRef.current = false;
        },
      });
    }
  }, [open, shouldRender]);

  return (
    <>
      <div
        className={cn(
          "h-10 px-4 py-4 flex flex-row md:hidden items-center justify-between bg-[var(--dark-surface)] border-b border-[var(--dark-border)] w-full"
        )}
        {...props}
      >
        <div className="flex justify-end z-20 w-full">
          <Menu
            className="text-gray-700 dark:text-dark-text-primary cursor-pointer"
            onClick={() => setOpen(!open)}
          />
        </div>
        {shouldRender && (
          <div
            ref={ref}
            className={cn(
              "fixed h-full w-full inset-0 bg-[var(--dark-bg)] p-10 z-[100] flex flex-col justify-between",
              className
            )}
            style={{ transform: 'translateX(-100%)', opacity: 0 }}
          >
            <div
              className="absolute right-10 top-10 z-50 text-gray-700 dark:text-dark-text-primary cursor-pointer"
              onClick={() => setOpen(!open)}
            >
              <X />
            </div>
            {children}
          </div>
        )}
      </div>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  isActive,
  ...props
}: {
  link: Links;
  className?: string;
  isActive?: boolean;
  props?: LinkProps;
}) => {
  const { open, animate } = useSidebar();

  const iconWithColor = isActive
    ? React.cloneElement(link.icon as React.ReactElement, {
        className: cn(
          (link.icon as React.ReactElement)?.props?.className,
          "text-[#2490FD]"
        ),
      })
    : React.cloneElement(link.icon as React.ReactElement, {
        className: cn(
          (link.icon as React.ReactElement)?.props?.className,
          "text-[#9ca3af] group-hover/sidebar:text-white"
        ),
      });

  const showLabel = animate ? open : true;

  return (
    <Link
      href={link.href}
      className={cn(
        "flex items-center justify-between gap-2 group/sidebar py-2 px-3 rounded-lg transition-colors relative",
        isActive
          ? "text-white dark:text-white"
          : "text-[#9ca3af] dark:text-[#9ca3af] hover:bg-[#1f2937] dark:hover:bg-[#1f2937]",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        {iconWithColor}
        <span
          className={cn(
            "text-[.85rem] group-hover/sidebar:translate-x-1 transition-all duration-200 whitespace-pre inline-block !p-0 !m-0",
            isActive ? "text-white" : "text-[#9ca3af] group-hover/sidebar:text-white",
            !showLabel && "opacity-0 w-0 overflow-hidden"
          )}
        >
          {link.label}
        </span>
      </div>
      {isActive && (
        <span
          className={cn(
            "text-white inline-block transition-all duration-200",
            !showLabel && "opacity-0 w-0 overflow-hidden"
          )}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6 12L10 8L6 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
    </Link>
  );
};
