"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";

export function Header() {
    const [scrolled, setScrolled] = useState(false);
    const { scrollY } = useScroll();

    useMotionValueEvent(scrollY, "change", (latest) => {
        setScrolled(latest > 20);
    });

    const navLinks = [
        { name: "Features", href: "#features" },
        { name: "Community", href: "#community" },
        { name: "Safety", href: "#safety" },
    ];

    return (
        <motion.header
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
                ? "bg-[#FAF9F7]/95 backdrop-blur-md border-b border-[#E5E5E5] shadow-sm"
                : "bg-transparent"
                }`}
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
            <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="relative w-10 h-10 flex items-center justify-center">
                        <Image
                            src="/logo.png"
                            alt="Campustry"
                            fill
                            sizes="40px"
                            className="object-contain"
                            priority
                        />
                    </div>
                    <span className="text-2xl font-bold text-[#2D5A47] tracking-tight">
                        Campustry
                    </span>
                </Link>

                {/* Nav Links */}
                <nav className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <Link
                            key={link.name}
                            href={link.href}
                            className="text-sm font-medium text-[#6B6B6B] hover:text-[#2D5A47] transition-colors"
                        >
                            {link.name}
                        </Link>
                    ))}
                </nav>

                {/* CTA */}
                <button className="hidden md:block px-6 py-2.5 bg-[#2D5A47] text-white rounded-full font-semibold text-sm hover:bg-[#234537] transition-all hover:scale-105 active:scale-95 shadow-md hover:shadow-lg">
                    Download App
                </button>

                {/* Mobile Menu Button */}
                <button className="md:hidden w-10 h-10 flex flex-col items-center justify-center gap-1.5">
                    <span className="w-6 h-0.5 bg-[#2D5A47] rounded-full" />
                    <span className="w-6 h-0.5 bg-[#2D5A47] rounded-full" />
                    <span className="w-6 h-0.5 bg-[#2D5A47] rounded-full" />
                </button>
            </div>
        </motion.header>
    );
}
