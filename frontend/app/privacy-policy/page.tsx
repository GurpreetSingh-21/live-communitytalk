"use client";

import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";

export default function PrivacyPolicyPage() {
    return (
        <main className="min-h-screen bg-[#FAF9F7]">
            <Header />

            <div className="pt-32 pb-20 container mx-auto px-6 max-w-4xl">
                <div className="mb-12">
                    <div className="inline-block px-4 py-1.5 rounded-full bg-[#2D5A47]/10 text-[#2D5A47] font-medium text-sm mb-4">
                        Effective Date: January 15, 2026
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-[#1A1A1A] mb-6 tracking-tight">
                        Privacy Policy
                    </h1>
                    <p className="text-xl text-[#6B6B6B] leading-relaxed">
                        At Campustry, trust is our chemistry. We are committed to protecting your personal information and being transparent about what we collect as you connect with your verified campus community.
                    </p>
                </div>

                <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-[#E5E5E5] space-y-12">

                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">1. Introduction</h2>
                        <p className="text-[#6B6B6B] leading-relaxed">
                            Campustry ("we," "our," or "us") provides a verified social platform for university students. This Privacy Policy explains how we collect, use, disclosure, and safeguard your information when you visit our website or use our mobile application. Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the application.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">2. Information We Collect</h2>
                        <p className="text-[#6B6B6B] mb-4">
                            We collect information that identifies you personally and information that does not. The types of data we collect include:
                        </p>
                        <ul className="space-y-4 text-[#6B6B6B]">
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <div>
                                    <strong className="text-[#1A1A1A]">University Verification Data:</strong> To maintain our verified community, we require your valid university (.edu) email address. This is used solely for authentication and is not shared publicly.
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <div>
                                    <strong className="text-[#1A1A1A]">Profile Information:</strong> Data you provide for your profile, such as your full name, major, graduation year, bio, and profile photos.
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <div>
                                    <strong className="text-[#1A1A1A]">Dating & Social Preferences:</strong> If you use our Dating features, we collect information regarding your gender identity, dating preferences, biological sex, hobbies, height, and location data to facilitate relevant matches.
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <div>
                                    <strong className="text-[#1A1A1A]">Communications:</strong> We store messages, chats, and content you share within communities. For your security, certain Direct Messages may be end-to-end encrypted or protected, though our moderation tools may scan content for safety violations (e.g., harassment, hate speech).
                                </div>
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">3. How We Use Your Information</h2>
                        <p className="text-[#6B6B6B] mb-4">
                            Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we use information collected about you via the Application to:
                        </p>
                        <ul className="grid md:grid-cols-2 gap-4 text-[#6B6B6B]">
                            <li className="bg-[#FAF9F7] p-4 rounded-xl border border-[#E5E5E5]">
                                Verify your student status and college affiliation.
                            </li>
                            <li className="bg-[#FAF9F7] p-4 rounded-xl border border-[#E5E5E5]">
                                Facilitate account creation and logon processes.
                            </li>
                            <li className="bg-[#FAF9F7] p-4 rounded-xl border border-[#E5E5E5]">
                                Enable user-to-user communications and community posts.
                            </li>
                            <li className="bg-[#FAF9F7] p-4 rounded-xl border border-[#E5E5E5]">
                                Provide targeted dating matches based on your preferences.
                            </li>
                            <li className="bg-[#FAF9F7] p-4 rounded-xl border border-[#E5E5E5]">
                                Monitor against theft, harassment, and unsafe behavior.
                            </li>
                            <li className="bg-[#FAF9F7] p-4 rounded-xl border border-[#E5E5E5]">
                                Notify you of updates, new features, and relevant campus events.
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">4. Disclosure of Your Information</h2>
                        <p className="text-[#6B6B6B] mb-4">
                            We take your privacy seriously. <strong className="text-[#1A1A1A]">We do not sell your personal data.</strong> We may share information we have collected about you in certain situations:
                        </p>
                        <ul className="space-y-4 text-[#6B6B6B]">
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <div>
                                    <strong className="text-[#1A1A1A]">By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others.
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <div>
                                    <strong className="text-[#1A1A1A]">With Other Users:</strong> When you share content in a public community or interact with other users (e.g., swiping, chatting), utilized information is visible to them. Your email address is never public.
                                </div>
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">5. Security of Your Information</h2>
                        <p className="text-[#6B6B6B] leading-relaxed">
                            We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures differ from perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">6. Policy for Children</h2>
                        <p className="text-[#6B6B6B] leading-relaxed">
                            We do not knowingly solicit information from or market to children under the age of 18. The application is strictly for university students. By using the Application, you represent that you are at least 18 years of age.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">7. Contact Us</h2>
                        <p className="text-[#6B6B6B] mb-4">
                            If you have questions or comments about this Privacy Policy, please contact us at:
                        </p>
                        <div className="bg-[#FAF9F7] p-6 rounded-2xl border border-[#E5E5E5]">
                            <p className="font-bold text-[#1A1A1A] mb-1">Campustry Privacy Team</p>
                            <a href="mailto:debugdragons4@gmail.com" className="text-[#2D5A47] hover:underline">debugdragons4@gmail.com</a>
                        </div>
                    </section>

                </div>
            </div>

            <Footer />
        </main>
    );
}
