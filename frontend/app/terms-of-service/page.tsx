"use client";

import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";

export default function TermsOfServicePage() {
    return (
        <main className="min-h-screen bg-[#FAF9F7]">
            <Header />

            <div className="pt-32 pb-20 container mx-auto px-6 max-w-4xl">
                <div className="mb-12">
                    <div className="inline-block px-4 py-1.5 rounded-full bg-[#2D5A47]/10 text-[#2D5A47] font-medium text-sm mb-4">
                        Last Updated: January 15, 2026
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-[#1A1A1A] mb-6 tracking-tight">
                        Terms of Service
                    </h1>
                    <p className="text-xl text-[#6B6B6B] leading-relaxed">
                        Welcome to Campustry. By accessing or using our platform, you agree to be bound by these terms. We keep our community safe, verified, and authentic.
                    </p>
                </div>

                <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-[#E5E5E5] space-y-12">

                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">1. Acceptance of Terms</h2>
                        <p className="text-[#6B6B6B] leading-relaxed">
                            These Terms of Service constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you") and Campustry ("we," "us" or "our"), concerning your access to and use of our mobile application and website. You agree that by accessing the site, you have read, understood, and agreed to be bound by all of these Terms of Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">2. Eligibility & Verification</h2>
                        <ul className="space-y-4 text-[#6B6B6B]">
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">2.1</span>
                                <div>
                                    You must be at least 18 years of age to use Campustry.
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">2.2</span>
                                <div>
                                    To access most features, you must verify your status as a current student using a valid university email address (.edu). We reserve the right to suspend accounts that cannot satisfy verification requirements.
                                </div>
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">3. User Responsibilities & Conduct</h2>
                        <p className="text-[#6B6B6B] mb-4">
                            You are responsible for your use of the Services and for any content you provide. You agree not to:
                        </p>
                        <ul className="grid gap-3 text-[#6B6B6B]">
                            <li className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span>Harass, threaten, or intimidate verified students or staff.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span>Impersonate any person or entity or falsely state your affiliation with a university.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span>Distribute spam, unauthorized advertising, or solicitations on community boards.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span>Post content that is hate speech, sexually explicit, or promotes illegal acts.</span>
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">4. Content & Ownership</h2>
                        <p className="text-[#6B6B6B] leading-relaxed mb-4">
                            You retain ownership of the content (photos, messages, bios) you post. However, by posting, you grant Campustry a non-exclusive, royalty-free license to use, display, and reproduce your content within the platform services (e.g., showing your profile to matches).
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">5. Moderation & Termination</h2>
                        <p className="text-[#6B6B6B] leading-relaxed mb-4">
                            We reserve the right to remove content and suspend or ban users that violate these Terms. Our moderation system employs a strike policy:
                        </p>
                        <div className="bg-[#FAF9F7] rounded-2xl p-6 border border-[#E5E5E5] grid md:grid-cols-3 gap-6">
                            <div>
                                <h3 className="font-bold text-[#1A1A1A] mb-2">Warnings</h3>
                                <p className="text-sm text-[#6B6B6B]">Minor infractions may result in a formal warning or temporary mute.</p>
                            </div>
                            <div>
                                <h3 className="font-bold text-[#1A1A1A] mb-2">Strikes</h3>
                                <p className="text-sm text-[#6B6B6B]">Accumulating strikes leads to temporary suspensions from social features.</p>
                            </div>
                            <div>
                                <h3 className="font-bold text-[#1A1A1A] mb-2">Permanent Bans</h3>
                                <p className="text-sm text-[#6B6B6B]">Severe safety violations or fraud result in immediate, permanent account termination.</p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">6. Disclaimers</h2>
                        <p className="text-[#6B6B6B] leading-relaxed">
                            The service is provided on an "as-is" and "as-available" basis. Campustry makes no warranties regarding the accuracy of user-provided information. We are not responsible for the conduct of any user online or offline.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">7. Contact</h2>
                        <p className="text-[#6B6B6B] mb-4">
                            For legal inquiries or reports of violations:
                        </p>
                        <a href="mailto:debugdragons4@gmail.com" className="font-semibold text-[#2D5A47] hover:underline">debugdragons4@gmail.com</a>
                    </section>

                </div>
            </div>

            <Footer />
        </main>
    );
}
