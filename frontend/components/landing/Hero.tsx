"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export function Hero() {
    return (
        <section className="relative min-h-screen flex items-center justify-center pt-24 pb-16 overflow-hidden bg-gradient-to-b from-[#FAF9F7] to-white">
            {/* Subtle Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(45,90,71,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(45,90,71,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)]" />

            <div className="container mx-auto px-6 z-10">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    {/* Left: Text Content */}
                    <div className="space-y-8">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2D5A47]/5 border border-[#2D5A47]/10 text-[#2D5A47] text-sm font-medium"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                            </svg>
                            Where Campus Meets Chemistry
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, delay: 0.2 }}
                            className="text-5xl md:text-7xl font-black text-[#1A1A1A] tracking-tight leading-[1.1]"
                        >
                            Your Campus.{" "}
                            <span className="text-[#2D5A47] relative inline-block">
                                Unfiltered.
                                <svg
                                    className="absolute -bottom-2 left-0 w-full h-3 text-[#FF7F6E]"
                                    viewBox="0 0 200 12"
                                    preserveAspectRatio="none"
                                >
                                    <path
                                        d="M0 8 Q50 2, 100 6 T200 8"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, delay: 0.3 }}
                            className="text-xl text-[#6B6B6B] leading-relaxed max-w-xl"
                        >
                            The only app your Dean probably hates. Connect with verified students, anonymously or not.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, delay: 0.4 }}
                            className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-4"
                        >
                            <button className="group px-8 py-4 bg-[#2D5A47] text-white rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center gap-2">
                                Get the Tea
                                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </button>
                            <button className="px-8 py-4 bg-white border-2 border-[#2D5A47]/20 text-[#2D5A47] rounded-2xl font-bold text-lg hover:border-[#2D5A47] hover:shadow-md transition-all">
                                Learn More
                            </button>
                        </motion.div>

                        {/* Social Proof */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.7, delay: 0.5 }}
                            className="flex items-center gap-6 pt-8"
                        >
                            <div className="flex -space-x-3">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2D5A47] to-[#FF7F6E] border-2 border-white" />
                                ))}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-[#1A1A1A]">1,000+ Students</p>
                                <p className="text-xs text-[#6B6B6B]">Across 25+ universities</p>
                            </div>
                        </motion.div>
                    </div>

                    {/* Right: 3D Illustration */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 40 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.9, delay: 0.3, type: "spring" }}
                        className="relative"
                    >
                        <div className="relative aspect-square rounded-3xl overflow-hidden shadow-2xl">
                            <Image
                                src="/hero-3d.png"
                                alt="Students connecting on campus"
                                fill
                                className="object-cover"
                                priority
                            />
                        </div>
                        {/* Decorative Elements */}
                        <div className="absolute -z-10 -top-6 -right-6 w-32 h-32 bg-[#FF7F6E]/20 rounded-full blur-3xl" />
                        <div className="absolute -z-10 -bottom-6 -left-6 w-40 h-40 bg-[#2D5A47]/10 rounded-full blur-3xl" />
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
