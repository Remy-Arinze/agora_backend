"use client";

import { cn } from "@/lib/utils";
import Link, { LinkProps } from "next/link";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
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

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...(props as React.ComponentProps<"div">)} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();

  return (
    <motion.div
      className={cn(
        "h-screen px-4 py-4 hidden md:flex md:flex-col bg-[#0f1419] dark:bg-[#0f1419] border-r border-[#1a1f2e] dark:border-[#1a1f2e] w-[250px] flex-shrink-0 fixed left-0 top-0 z-20",
        className
      )}
      animate={{
        width: animate ? (open ? "250px" : "80px") : "250px",
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();

  return (
    <>
      <div
        className={cn(
          "h-10 px-4 py-4 flex flex-row md:hidden items-center justify-between bg-light-card dark:bg-[#151a23] border-b border-light-border dark:border-[#1a1f2e] w-full"
        )}
        {...props}
      >
        <div className="flex justify-end z-20 w-full">
          <Menu
            className="text-gray-700 dark:text-dark-text-primary cursor-pointer"
            onClick={() => setOpen(!open)}
          />
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: "easeInOut",
              }}
              className={cn(
                "fixed h-full w-full inset-0 bg-light-card dark:bg-[#0f1419] p-10 z-[100] flex flex-col justify-between",
                className
              )}
            >
              <div
                className="absolute right-10 top-10 z-50 text-gray-700 dark:text-dark-text-primary cursor-pointer"
                onClick={() => setOpen(!open)}
              >
                <X />
              </div>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
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

  // Clone icon and apply accent blue color when active, gray when inactive
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

  return (
    <Link
      href={link.href}
      className={cn(
        "flex items-center justify-between gap-2 group/sidebar py-2 px-3 rounded-lg transition-colors relative",
        // No background for active, just highlighted icon and white text
        isActive
          ? "text-white dark:text-white"
          : "text-[#9ca3af] dark:text-[#9ca3af] hover:bg-[#1f2937] dark:hover:bg-[#1f2937]",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        {iconWithColor}
        <motion.span
          animate={{
            display: animate ? (open ? "inline-block" : "none") : "inline-block",
            opacity: animate ? (open ? 1 : 0) : 1,
          }}
          className={cn(
            "text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0",
            isActive ? "text-white" : "text-[#9ca3af] group-hover/sidebar:text-white"
          )}
        >
          {link.label}
        </motion.span>
      </div>
      {/* Right arrow indicator for active link */}
      {isActive && (
        <motion.div
          animate={{
            display: animate ? (open ? "inline-block" : "none") : "inline-block",
            opacity: animate ? (open ? 1 : 0) : 1,
          }}
          className="text-white"
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
        </motion.div>
      )}
    </Link>
  );
};

