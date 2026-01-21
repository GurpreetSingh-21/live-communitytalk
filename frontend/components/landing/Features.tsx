"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const features = [
    {
        id: 1,
        title: "Verified Students Only",
        description: "Connect with real, verified students from your campus and beyond. No bots, no spam—just authentic connections.",
        image: "/verified-3d.png",
        imagePosition: "right" as const,
    },
    {
        id: 2,
        title: "Campus Communities",
        description: "Join clubs, study groups, and interest-based communities. From chess club to coding bootcamps, find your tribe.",
        image: "/communities-3d.png",
        imagePosition: "left" as const,
    },
    {
        id: 3,
        title: "Private & Secure",
        description: "Your conversations are encrypted end-to-end. What you share stays between you and your friends.",
        image: "/security-3d.png",
        imagePosition: "right" as const,
    },
    {
        id: 4,
        title: "Events & Meetups",
        description: "Discover campus events, study sessions, and social gatherings. Never miss what's happening around you.",
        image: "/events-all-3d.png",
        imagePosition: "left" as const,
    },
];

export function Features() {
    return (
        <section id="features" className="py-24 bg-gradient-to-b from-[#FAF9F7] to-white relative overflow-hidden">
            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(45,90,71,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(45,90,71,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)]" />

            <div className="container mx-auto px-6 relative z-10">
                {/* Section Header */}
                <div className="text-center max-w-3xl mx-auto mb-24">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="text-4xl md:text-5xl font-black text-[#1A1A1A] mb-6"
                    >
                        Built for Campus Life,{" "}
                        <span className="text-[#2D5A47]">Designed for Connection</span>
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-lg text-[#6B6B6B] leading-relaxed"
                    >
                        From study groups to soulmates, Campustry brings your campus community together. Safe, verified, and built for the modern student.
                    </motion.p>
                </div>

                {/* Features with alternating layout */}
                <div className="space-y-32">
                    {features.map((feature, index) => (
                        <div
                            key={feature.id}
                            className="grid lg:grid-cols-2 gap-16 items-center"
                        >
                            {/* Image (conditionally ordered) */}
                            <motion.div
                                initial={{ opacity: 0, x: feature.imagePosition === "right" ? 30 : -30 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.7 }}
                                className={`relative ${feature.imagePosition === "left" ? "order-1 lg:order-1" : "order-1 lg:order-2"
                                    }`}
                            >
                                <div className="relative aspect-square rounded-3xl overflow-hidden shadow-2xl">
                                    <Image
                                        src={feature.image}
                                        alt={feature.title}
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                                {/* Decorative glow */}
                                <div className="absolute -z-10 -bottom-6 -right-6 w-64 h-64 bg-[#2D5A47]/10 rounded-full blur-3xl" />
                            </motion.div>

                            {/* Content (conditionally ordered) */}
                            <motion.div
                                initial={{ opacity: 0, x: feature.imagePosition === "right" ? -30 : 30 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.7, delay: 0.2 }}
                                className={`space-y-6 ${feature.imagePosition === "left" ? "order-2 lg:order-2" : "order-2 lg:order-1"
                                    }`}
                            >
                                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2D5A47]/5 border border-[#2D5A47]/10">
                                    <span className="text-2xl font-black text-[#2D5A47]">
                                        {String(index + 1).padStart(2, '0')}
                                    </span>
                                </div>

                                <h3 className="text-3xl md:text-4xl font-black text-[#1A1A1A]">
                                    {feature.title}
                                </h3>

                                <p className="text-lg text-[#6B6B6B] leading-relaxed">
                                    {feature.description}
                                </p>

                                <div className="flex items-center gap-2 pt-4">
                                    <div className="h-1 w-12 bg-gradient-to-r from-[#2D5A47] to-[#FF7F6E] rounded-full" />
                                </div>
                            </motion.div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
