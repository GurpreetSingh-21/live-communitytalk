"use client";

import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";

export default function ContactPage() {
    return (
        <main className="min-h-screen bg-[#FAF9F7]">
            <Header />

            <div className="pt-32 pb-20 container mx-auto px-6 max-w-4xl">
                <div className="mb-12 text-center">
                    <div className="inline-block px-4 py-1.5 rounded-full bg-[#2D5A47]/10 text-[#2D5A47] font-medium text-sm mb-4">
                        Get in Touch
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-[#1A1A1A] mb-6 tracking-tight">
                        Contact Us
                    </h1>
                    <p className="text-xl text-[#6B6B6B] leading-relaxed max-w-2xl mx-auto">
                        Have questions about verification, community features, or just want to say hi? We're here to help.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Contact Info Card */}
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#E5E5E5] flex flex-col justify-between">
                        <div>
                            <div className="w-12 h-12 bg-[#2D5A47]/10 rounded-2xl flex items-center justify-center text-[#2D5A47] mb-6">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">Email Us</h2>
                            <p className="text-[#6B6B6B] mb-8">
                                For support, business inquiries, or legal questions, drop us a line directly.
                            </p>
                        </div>

                        <div>
                            <p className="text-sm font-medium text-[#6B6B6B] mb-1">Direct Email</p>
                            <a href="mailto:debugdragons4@gmail.com" className="text-xl font-bold text-[#2D5A47] hover:underline break-all">
                                debugdragons4@gmail.com
                            </a>
                        </div>
                    </div>

                    {/* FAQ / Quick Help Card */}
                    <div className="bg-[#2D5A47] rounded-3xl p-8 shadow-xl text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl -ml-16 -mb-16" />

                        <div className="relative z-10 h-full flex flex-col justify-between">
                            <div>
                                <h2 className="text-2xl font-bold mb-4">Quick Help</h2>
                                <p className="text-white/80 mb-8">
                                    Most users find answers to their questions in our community guidelines or by checking their account status.
                                </p>

                                <ul className="space-y-4">
                                    <li className="flex items-center gap-3 text-white/90">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#FF7F6E]" />
                                        University Verification
                                    </li>
                                    <li className="flex items-center gap-3 text-white/90">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#FF7F6E]" />
                                        Profile Safety & Reporting
                                    </li>
                                    <li className="flex items-center gap-3 text-white/90">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#FF7F6E]" />
                                        Community Guidelines
                                    </li>
                                </ul>
                            </div>

                            <a
                                href="/terms-of-service"
                                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-white text-[#2D5A47] font-bold mt-8 hover:bg-opacity-90 transition-all"
                            >
                                View Guidelines
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            <Footer />
        </main>
    );
}
