"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export function Dating() {
    return (
        <section className="py-32 bg-gradient-to-b from-white to-[#FAF9F7] relative overflow-hidden">
            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(45,90,71,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(45,90,71,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)]" />

            {/* Decorative elements */}
            <div className="absolute top-20 right-20 w-64 h-64 bg-[#FF7F6E]/5 rounded-full blur-3xl" />
            <div className="absolute bottom-20 left-20 w-80 h-80 bg-[#2D5A47]/5 rounded-full blur-3xl" />

            <div className="container mx-auto px-6 relative z-10">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    {/* Left: Image */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7 }}
                        className="relative order-2 lg:order-1"
                    >
                        <div className="relative aspect-square rounded-3xl overflow-hidden shadow-2xl">
                            <Image
                                src="/dating-3d.png"
                                alt="Find your chemistry on campus"
                                fill
                                className="object-cover"
                            />
                        </div>
                        {/* Floating hearts */}
                        <div className="absolute -top-4 -right-4 w-20 h-20 bg-[#FF7F6E]/10 rounded-full flex items-center justify-center backdrop-blur-sm border border-[#FF7F6E]/20">
                            <svg className="w-10 h-10 text-[#FF7F6E]" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                            </svg>
                        </div>
                    </motion.div>

                    {/* Right: Content */}
                    <div className="space-y-8 order-1 lg:order-2">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FF7F6E]/5 border border-[#FF7F6E]/20 text-[#FF7F6E] text-sm font-medium"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                            </svg>
                            Student Dating
                        </motion.div>

                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="text-4xl md:text-5xl font-black text-[#1A1A1A]"
                        >
                            Find Real{" "}
                            <span className="text-[#FF7F6E] relative">
                                Chemistry
                                <svg
                                    className="absolute -bottom-1 left-0 w-full h-2"
                                    viewBox="0 0 200 8"
                                    preserveAspectRatio="none"
                                >
                                    <path
                                        d="M0 6 Q50 2, 100 5 T200 6"
                                        fill="none"
                                        stroke="#2D5A47"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </span>
                            {" "}On Campus
                        </motion.h2>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="text-lg text-[#6B6B6B] leading-relaxed"
                        >
                            Why swipe endlessly when you can meet verified students who actually go to your school? Campustry's dating feature helps you discover genuine connections with people you might pass every day on campus.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                            className="space-y-4"
                        >
                            {[
                                { icon: "✓", text: "Verified students only" },
                                { icon: "✓", text: "Same campus, real connections" },
                                { icon: "✓", text: "Safe, private, and respectful" },
                            ].map((item, index) => (
                                <div key={index} className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-[#2D5A47] text-white flex items-center justify-center text-sm font-bold">
                                        {item.icon}
                                    </div>
                                    <p className="text-[#1A1A1A] font-medium">{item.text}</p>
                                </div>
                            ))}
                        </motion.div>

                        <motion.button
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.4 }}
                            className="px-8 py-4 bg-[#FF7F6E] text-white rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
                        >
                            Start Finding Matches
                        </motion.button>
                    </div>
                </div>
            </div>
        </section>
    );
}
