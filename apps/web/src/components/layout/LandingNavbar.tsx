'use client';

import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export function LandingNavbar() {
    const { user } = useAuth();
    const pathname = usePathname();
    const isHomePage = pathname === '/';
    // Initialize based on pathname to match server render
    const [isLightSection, setIsLightSection] = useState(!isHomePage);
    const [isMounted, setIsMounted] = useState(false);
    const [hasScrolled, setHasScrolled] = useState(false);

    // Ensure component is mounted before applying dynamic styles
    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isMounted) return;

        if (!isHomePage) {
            setIsLightSection(true);
            return;
        }

        // Check which section is dominant in viewport
        const checkInitialSection = () => {
            const sections = document.querySelectorAll('section');
            const viewportHeight = window.innerHeight;
            
            // Hero section is always the first section
            const heroSection = sections[0] as HTMLElement | undefined;
            
            if (heroSection) {
                const heroRect = heroSection.getBoundingClientRect();
                // Calculate visible height of hero section in viewport
                const heroTop = Math.max(0, heroRect.top);
                const heroBottom = Math.min(viewportHeight, heroRect.bottom);
                const heroVisibleHeight = Math.max(0, heroBottom - heroTop);
                const heroVisiblePercent = heroVisibleHeight / viewportHeight;
                
                // Keep white navbar if hero is still more than 30% visible
                if (heroVisiblePercent > 0.3) {
                    setIsLightSection(false);
                    return;
                }
            }
            
            // Hero is mostly scrolled past, check if we're over a light section
            let topLightSection: HTMLElement | null = null;
            let minTop = Infinity;

            sections.forEach((section) => {
                const rect = section.getBoundingClientRect();
                const needsLightNavbar = section.dataset.navbarLight === 'true';
                
                // Find the topmost light section that's in or near viewport
                if (needsLightNavbar && rect.top >= -200 && rect.top < minTop) {
                    minTop = rect.top;
                    topLightSection = section as HTMLElement;
                }
            });

            // Switch to light navbar if we're over a light section
            setIsLightSection(!!topLightSection);
        };

        // Check on mount and scroll
        checkInitialSection();
        const handleScroll = () => {
            // Track if user has scrolled
            if (window.scrollY > 50) {
                setHasScrolled(true);
            } else {
                setHasScrolled(false);
            }
            checkInitialSection();
        };
        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, [isHomePage, isMounted]);

    const navLinks = [
        { href: '/', label: 'Home' },
        { href: '/products', label: 'Products' },
        { href: '/about', label: 'About' },
    ];

    const isActive = (href: string) => {
        if (href === '/') {
            return pathname === '/';
        }
        return pathname.startsWith(href);
    };

    // Determine navbar style based on section
    const useLightNavbar = isHomePage ? isLightSection : true;
    const logoColor = useLightNavbar ? 'bg-blue-600 dark:bg-blue-500' : 'bg-white';
    const textColor = useLightNavbar ? 'text-blue-600 dark:text-blue-400' : 'text-white';
    const linkColor = useLightNavbar 
        ? 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
        : 'text-white/70 hover:text-white';
    const activeLinkColor = useLightNavbar 
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-white';
    const navBg = useLightNavbar 
        ? 'bg-[var(--light-bg)]/80 dark:bg-dark-bg/80 backdrop-blur-md'
        : hasScrolled 
            ? 'bg-transparent backdrop-blur-md'
            : 'bg-transparent';

    return (
        <nav className={`transition-all duration-300 fixed top-0 right-0 left-0 z-30 ${navBg}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex items-center">
                        <Link href="/" className="flex items-center">
                            <Image
                                src="/assets/logos/agora_main.png"
                                alt="Agora - Digital Education Identity Logo"
                                width={120}
                                height={32}
                                className="h-8 w-auto flex-shrink-0 transition-opacity duration-300"
                            />
                        </Link>
                        <div className="hidden md:flex items-center ml-10 space-x-6">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`relative text-sm font-medium transition-colors pb-1 ${
                                        isActive(link.href) ? activeLinkColor : linkColor
                                    }`}
                                >
                                    {link.label}
                                    {isActive(link.href) && (
                                        <span className={`absolute bottom-0 left-0 w-full h-0.5 rounded-full ${
                                            useLightNavbar ? 'bg-blue-500' : 'bg-white'
                                        }`} />
                                    )}
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        {isMounted && !user && (
                            <div className="flex items-center space-x-2">
                                <Link href="/auth/login">
                                    <Button variant="white" size="sm" className="rounded-full px-5 font-bold">
                                        Login
                                    </Button>
                                </Link>
                                <Link href="/auth/login">
                                    <Button variant="primary" size="sm" className="rounded-full px-5 font-bold">
                                        Get Started
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
