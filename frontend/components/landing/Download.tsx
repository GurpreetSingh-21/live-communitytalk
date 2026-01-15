"use client";

import { motion } from "framer-motion";

export function Download() {
    return (
        <section className="py-32 bg-gradient-to-br from-[#2D5A47] to-[#234537] relative overflow-hidden">
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#FF7F6E]/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl" />

            <div className="container mx-auto px-6 relative z-10 text-center">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7 }}
                    className="max-w-4xl mx-auto"
                >
                    <h2 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">
                        FOMO is Real. Don't Miss Out.
                    </h2>
                    <p className="text-xl text-white/80 mb-12 max-w-2xl mx-auto leading-relaxed">
                        The group chat you can't get kicked out of. Join 10,000+ students and get the tea.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                        {/* App Store Button */}
                        <a
                            href="#"
                            className="group flex items-center gap-4 px-8 py-4 bg-white text-[#1A1A1A] rounded-2xl font-bold shadow-2xl hover:shadow-3xl hover:scale-105 transition-all"
                        >
                            <svg className="w-10 h-10" viewBox="0 0 40 40" fill="currentColor">
                                <path d="M28.5 20.5c0-3.8 3.1-5.6 3.2-5.7-1.8-2.6-4.5-2.9-5.5-3-2.3-.2-4.5 1.4-5.7 1.4-1.2 0-3-1.3-5-1.3-2.5 0-4.9 1.5-6.2 3.8-2.6 4.6-.7 11.4 1.9 15.1 1.3 1.8 2.8 3.9 4.8 3.8 1.9-.1 2.6-1.2 4.9-1.2 2.3 0 3 1.2 4.9 1.2 2 0 3.4-1.8 4.7-3.7 1.5-2.1 2.1-4.2 2.1-4.3-.1 0-4-.2-4.1-4.1z" />
                                <path d="M25.3 8.8c1.1-1.3 1.8-3.1 1.6-4.9-1.6.1-3.5 1.1-4.6 2.4-1 1.2-1.9 3-1.7 4.8 1.8.1 3.6-.9 4.7-2.3z" />
                            </svg>
                            <div className="text-left">
                                <p className="text-xs opacity-70">Download on the</p>
                                <p className="text-lg font-black">App Store</p>
                            </div>
                        </a>

                        {/* Play Store Button */}
                        <a
                            href="#"
                            className="group flex items-center gap-4 px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/20 text-white rounded-2xl font-bold hover:bg-white/20 hover:scale-105 transition-all"
                        >
                            <svg className="w-10 h-10" viewBox="0 0 40 40" fill="currentColor">
                                <path d="M7 4.5L26.5 20 7 35.5V4.5zM28.5 22L9.5 32.5 24.5 20 9.5 7.5 28.5 18z" opacity="0.7" />
                                <path d="M7 4.5L26.5 20 28.5 18 9.5 7.5z" />
                                <path d="M7 35.5L26.5 20 28.5 22 9.5 32.5z" />
                            </svg>
                            <div className="text-left">
                                <p className="text-xs opacity-70">Get it on</p>
                                <p className="text-lg font-black">Google Play</p>
                            </div>
                        </a>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto mt-16 pt-12 border-t border-white/10">
                        <div>
                            <p className="text-4xl font-black text-white mb-2">25+</p>
                            <p className="text-sm text-white/60">Universities</p>
                        </div>
                        <div>
                            <p className="text-4xl font-black text-white mb-2">1K+</p>
                            <p className="text-sm text-white/60">Active Students</p>
                        </div>
                        <div>
                            <p className="text-4xl font-black text-white mb-2">4.9★</p>
                            <p className="text-sm text-white/60">App Rating</p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
