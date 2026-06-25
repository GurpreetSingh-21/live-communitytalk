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
                        Effective Date: June 24, 2026
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-[#1A1A1A] mb-6 tracking-tight">
                        Privacy Policy
                    </h1>
                    <p className="text-xl text-[#6B6B6B] leading-relaxed">
                        At Campustry, trust is our chemistry. We are committed to protecting your personal information and being transparent about what we collect, how we use it, and who we share it with as you connect with your verified campus community.
                    </p>
                </div>

                <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-[#E5E5E5] space-y-12">

                    {/* 1. Introduction */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">1. Introduction</h2>
                        <p className="text-[#6B6B6B] leading-relaxed">
                            Debug Dragons LLC, doing business as Campustry (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;), provides a verified social platform for university students. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website at campustry.com or use our mobile application (collectively, the &quot;Service&quot;). Please read this Privacy Policy carefully. If you do not agree with the terms of this Privacy Policy, please do not access or use the Service.
                        </p>
                    </section>

                    {/* 2. Information We Collect */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">2. Information We Collect</h2>
                        <p className="text-[#6B6B6B] mb-4">
                            We collect the following categories of information:
                        </p>
                        <ul className="space-y-4 text-[#6B6B6B]">
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <div>
                                    <strong className="text-[#1A1A1A]">Account Registration Data:</strong> Full name, email address, password (stored in hashed form), college affiliation, and religion/faith community selection. Your university email address is used for verification and authentication and is never displayed publicly.
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <div>
                                    <strong className="text-[#1A1A1A]">Profile Information:</strong> Data you voluntarily provide for your profile, such as your display name, bio, avatar photo, and college details.
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <div>
                                    <strong className="text-[#1A1A1A]">Dating Profile Data:</strong> If you opt into our dating features, we collect additional information including your first name, gender, date of birth, height, major, year of study, graduation year, Greek life affiliation, hobbies, interests, Spotify top artists, Instagram handle, custom prompts, and photos. This data is only collected when you actively create a dating profile and is used solely for matching purposes.
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <div>
                                    <strong className="text-[#1A1A1A]">Location Data:</strong> If you grant permission, we collect approximate location data to show dating profiles near your campus. Your exact location is never shared with other users. You may revoke location permission at any time through your device settings.
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <div>
                                    <strong className="text-[#1A1A1A]">Communications:</strong> We store messages you send in community group chats. These messages are stored on our servers to provide message history and enable moderation. <strong className="text-[#1A1A1A]">Direct Messages (DMs) are end-to-end encrypted</strong> using client-side cryptographic libraries. This means the content of your private conversations is encrypted on your device before transmission, and we cannot read or access the plaintext content of your DMs.
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <div>
                                    <strong className="text-[#1A1A1A]">Device Information:</strong> We collect push notification tokens, device type, and operating system version to deliver push notifications and ensure compatibility.
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <div>
                                    <strong className="text-[#1A1A1A]">Usage Data:</strong> We collect information about your interactions with the Service, including communities joined, message activity, and feature usage patterns, to improve the Service and ensure safety.
                                </div>
                            </li>
                        </ul>
                    </section>

                    {/* 3. How We Use Your Information */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">3. How We Use Your Information</h2>
                        <p className="text-[#6B6B6B] mb-4">
                            We use the information we collect for the following purposes:
                        </p>
                        <ul className="grid md:grid-cols-2 gap-4 text-[#6B6B6B]">
                            <li className="bg-[#FAF9F7] p-4 rounded-xl border border-[#E5E5E5]">
                                Verify your student status and college affiliation during registration.
                            </li>
                            <li className="bg-[#FAF9F7] p-4 rounded-xl border border-[#E5E5E5]">
                                Create and maintain your account, profile, and community memberships.
                            </li>
                            <li className="bg-[#FAF9F7] p-4 rounded-xl border border-[#E5E5E5]">
                                Enable user-to-user communications in communities and direct messages.
                            </li>
                            <li className="bg-[#FAF9F7] p-4 rounded-xl border border-[#E5E5E5]">
                                Provide dating match suggestions based on your preferences and profile data.
                            </li>
                            <li className="bg-[#FAF9F7] p-4 rounded-xl border border-[#E5E5E5]">
                                Send push notifications about messages, matches, and important account updates.
                            </li>
                            <li className="bg-[#FAF9F7] p-4 rounded-xl border border-[#E5E5E5]">
                                Enforce our Terms of Service, investigate reports, and protect against harassment, fraud, and unsafe behavior.
                            </li>
                        </ul>
                    </section>

                    {/* 4. Third-Party Service Providers */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">4. Third-Party Service Providers</h2>
                        <p className="text-[#6B6B6B] mb-4">
                            We share certain data with trusted third-party service providers who assist us in operating the Service. These providers are contractually obligated to use your data only for the purposes we specify:
                        </p>
                        <ul className="space-y-4 text-[#6B6B6B]">
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <div>
                                    <strong className="text-[#1A1A1A]">Cloudinary & ImageKit:</strong> For image upload, storage, optimization, and delivery (profile photos, dating photos, message attachments).
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <div>
                                    <strong className="text-[#1A1A1A]">Resend:</strong> For sending transactional emails such as verification codes, password resets, and security alerts.
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <div>
                                    <strong className="text-[#1A1A1A]">Firebase (Google):</strong> For push notification infrastructure and authentication services.
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <div>
                                    <strong className="text-[#1A1A1A]">Expo (Expo.dev):</strong> For mobile push notification delivery and application build services.
                                </div>
                            </li>
                        </ul>
                    </section>

                    {/* 5. Disclosure of Your Information */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">5. Disclosure of Your Information</h2>
                        <p className="text-[#6B6B6B] mb-4">
                            <strong className="text-[#1A1A1A]">We do not sell, rent, or trade your personal data to third parties.</strong> We may disclose information we have collected about you in the following limited circumstances:
                        </p>
                        <ul className="space-y-4 text-[#6B6B6B]">
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <div>
                                    <strong className="text-[#1A1A1A]">Legal Obligations:</strong> If we believe disclosure is necessary to comply with applicable law, regulation, legal process, or governmental request; to enforce our Terms of Service; or to protect the rights, property, or safety of Campustry, our users, or the public.
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <div>
                                    <strong className="text-[#1A1A1A]">With Other Users:</strong> When you post content in a community, your display name and avatar are visible to other community members. When you use dating features, your dating profile is shown to potential matches. Your email address is never publicly visible.
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <div>
                                    <strong className="text-[#1A1A1A]">Business Transfers:</strong> If Debug Dragons LLC is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you via email or a prominent notice within the Service before your information becomes subject to a different privacy policy.
                                </div>
                            </li>
                        </ul>
                    </section>

                    {/* 6. Data Retention & Deletion */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">6. Data Retention & Deletion</h2>
                        <p className="text-[#6B6B6B] leading-relaxed mb-4">
                            We retain your personal information for as long as your account is active or as needed to provide you with the Service. If you wish to delete your account, you may do so through your account settings or by contacting us at the email below. Upon account deletion:
                        </p>
                        <ul className="space-y-2 text-[#6B6B6B]">
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <span>Your profile, dating profile, and community memberships will be permanently removed.</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <span>Messages you sent in community chats may be retained in anonymized form for the integrity of ongoing conversations.</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <span>We may retain certain data as required by law or for legitimate business purposes such as fraud prevention and safety enforcement, for a period not to exceed 90 days after deletion.</span>
                            </li>
                        </ul>
                    </section>

                    {/* 7. Security of Your Information */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">7. Security of Your Information</h2>
                        <p className="text-[#6B6B6B] leading-relaxed">
                            We implement industry-standard administrative, technical, and physical security measures to protect your personal information. These include encrypted password storage (Bcrypt), end-to-end encryption for direct messages (TweetNaCl), rate limiting, content security policies (CSP), and strict access controls. While we take reasonable steps to secure your data, no method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security, but we are committed to promptly addressing any breach in accordance with applicable law.
                        </p>
                    </section>

                    {/* 8. Your Rights & Choices */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">8. Your Rights & Choices</h2>
                        <p className="text-[#6B6B6B] leading-relaxed mb-4">
                            Depending on your jurisdiction, you may have the following rights regarding your personal information:
                        </p>
                        <ul className="space-y-2 text-[#6B6B6B]">
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <span><strong className="text-[#1A1A1A]">Access & Portability:</strong> Request a copy of the personal data we hold about you.</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <span><strong className="text-[#1A1A1A]">Correction:</strong> Request correction of inaccurate or incomplete personal data.</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <span><strong className="text-[#1A1A1A]">Deletion:</strong> Request deletion of your personal data, subject to legal retention obligations.</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <span><strong className="text-[#1A1A1A]">Opt-Out:</strong> Disable push notifications through your device settings. Revoke location permissions at any time.</span>
                            </li>
                        </ul>
                        <p className="text-[#6B6B6B] leading-relaxed mt-4">
                            To exercise any of these rights, contact us at the email address listed below.
                        </p>
                    </section>

                    {/* 9. Children's Privacy */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">9. Children&apos;s Privacy</h2>
                        <p className="text-[#6B6B6B] leading-relaxed">
                            The Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from anyone under 18. Our dating features include server-side age verification that prevents any user under 18 from creating a dating profile. If we become aware that we have collected personal information from a minor, we will take steps to delete that information promptly. If you believe a minor has provided us with personal information, please contact us immediately.
                        </p>
                    </section>

                    {/* 10. Changes to This Privacy Policy */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">10. Changes to This Privacy Policy</h2>
                        <p className="text-[#6B6B6B] leading-relaxed">
                            We may update this Privacy Policy from time to time to reflect changes in our practices or applicable law. When we make material changes, we will notify you by updating the &quot;Effective Date&quot; at the top of this page and, where appropriate, sending a notification through the Service or via email. Your continued use of the Service after any changes constitutes your acceptance of the updated Privacy Policy.
                        </p>
                    </section>

                    {/* 11. Contact Us */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">11. Contact Us</h2>
                        <p className="text-[#6B6B6B] mb-4">
                            If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:
                        </p>
                        <div className="bg-[#FAF9F7] p-6 rounded-2xl border border-[#E5E5E5]">
                            <p className="font-bold text-[#1A1A1A] mb-1">Debug Dragons LLC — Campustry Privacy Team</p>
                            <a href="mailto:debugdragons4@gmail.com" className="text-[#2D5A47] hover:underline">debugdragons4@gmail.com</a>
                        </div>
                    </section>

                </div>
            </div>

            <Footer />
        </main>
    );
}
