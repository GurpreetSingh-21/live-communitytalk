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
                        Last Updated: June 24, 2026
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-[#1A1A1A] mb-6 tracking-tight">
                        Terms of Service
                    </h1>
                    <p className="text-xl text-[#6B6B6B] leading-relaxed">
                        Welcome to Campustry. By accessing or using our platform, you agree to be bound by these terms. Please read them carefully before using the Service.
                    </p>
                </div>

                <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-[#E5E5E5] space-y-12">

                    {/* 1. Acceptance of Terms */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">1. Acceptance of Terms</h2>
                        <p className="text-[#6B6B6B] leading-relaxed">
                            These Terms of Service (&quot;Terms&quot;) constitute a legally binding agreement between you (&quot;you&quot; or &quot;User&quot;) and Debug Dragons LLC, doing business as Campustry (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), governing your access to and use of the Campustry mobile application, website, and related services (collectively, the &quot;Service&quot;). By creating an account or using the Service in any way, you acknowledge that you have read, understood, and agree to be bound by these Terms and our <a href="/privacy-policy" className="text-[#2D5A47] hover:underline font-medium">Privacy Policy</a>, which is incorporated herein by reference.
                        </p>
                    </section>

                    {/* 2. Eligibility & Verification */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">2. Eligibility & Verification</h2>
                        <ul className="space-y-4 text-[#6B6B6B]">
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">2.1</span>
                                <div>
                                    You must be at least <strong className="text-[#1A1A1A]">18 years of age</strong> (or the age of majority in your jurisdiction, whichever is greater) to create an account and use the Service. By registering, you represent and warrant that you meet this age requirement.
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">2.2</span>
                                <div>
                                    To access core features, you must verify your status as a current student or affiliate of a recognized educational institution by providing a valid institutional email address. We reserve the right to suspend or terminate accounts that cannot satisfy verification requirements.
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">2.3</span>
                                <div>
                                    You may only maintain one account. You represent that you have not been previously suspended, banned, or permanently removed from the Service.
                                </div>
                            </li>
                        </ul>
                    </section>

                    {/* 3. User Accounts & Security */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">3. User Accounts & Security</h2>
                        <p className="text-[#6B6B6B] leading-relaxed mb-4">
                            You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You agree to:
                        </p>
                        <ul className="space-y-2 text-[#6B6B6B]">
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <span>Provide accurate, current, and complete information during registration and keep it updated.</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <span>Notify us immediately of any unauthorized access to or use of your account.</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <span>Enable two-factor authentication if available for enhanced security.</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-[#2D5A47] font-bold">•</span>
                                <span>Accept full responsibility for all activities conducted through your account, whether or not you authorized them.</span>
                            </li>
                        </ul>
                    </section>

                    {/* 4. User Conduct & Prohibited Activities */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">4. User Conduct & Prohibited Activities</h2>
                        <p className="text-[#6B6B6B] mb-4">
                            You are responsible for your use of the Service and for any content you provide. To maintain a safe and respectful campus environment, you agree not to:
                        </p>
                        <ul className="grid gap-3 text-[#6B6B6B]">
                            <li className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span>Harass, threaten, bully, stalk, or intimidate any user, student, or staff member.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span>Impersonate any person or entity, or falsely state or misrepresent your affiliation with a university.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span>Post content that constitutes hate speech, is sexually explicit, promotes illegal acts, or is defamatory.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span>Distribute spam, unsolicited advertising, chain letters, or solicitations of any kind.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span>Use automated bots, scrapers, crawlers, or any automated means to access the Service or extract data.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span>Attempt to bypass security measures, reverse-engineer the application, or interfere with the Service&apos;s infrastructure.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span>Use the dating features to solicit money, promote businesses, or engage in any commercial activity.</span>
                            </li>
                        </ul>
                    </section>

                    {/* 5. Content & Intellectual Property */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">5. Content & Intellectual Property</h2>
                        <p className="text-[#6B6B6B] leading-relaxed mb-4">
                            You retain ownership of the content you create and post on the Service, including messages, photos, bios, and profile information (&quot;User Content&quot;). By posting User Content, you grant Debug Dragons LLC a worldwide, non-exclusive, royalty-free, sublicensable license to use, host, store, reproduce, modify, and display your User Content solely for the purpose of operating, improving, and promoting the Service (for example, displaying your profile to potential matches or showing your messages to community members).
                        </p>
                        <p className="text-[#6B6B6B] leading-relaxed">
                            This license terminates when you delete your User Content or your account, except where your content has been shared with others who have not deleted it, or where retention is required by law.
                        </p>
                    </section>

                    {/* 6. Moderation, Enforcement & Termination */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">6. Moderation, Enforcement & Termination</h2>
                        <p className="text-[#6B6B6B] leading-relaxed mb-4">
                            We reserve the right to remove content and restrict, suspend, or permanently ban users who violate these Terms, at our sole discretion and without prior notice. Our moderation system employs the following escalation framework:
                        </p>
                        <div className="bg-[#FAF9F7] rounded-2xl p-6 border border-[#E5E5E5] grid md:grid-cols-3 gap-6">
                            <div>
                                <h3 className="font-bold text-[#1A1A1A] mb-2">Warnings</h3>
                                <p className="text-sm text-[#6B6B6B]">Minor or first-time infractions may result in a formal warning or temporary mute.</p>
                            </div>
                            <div>
                                <h3 className="font-bold text-[#1A1A1A] mb-2">Suspensions</h3>
                                <p className="text-sm text-[#6B6B6B]">Repeated violations or serious infractions result in temporary suspension from the Service or specific features (e.g., dating).</p>
                            </div>
                            <div>
                                <h3 className="font-bold text-[#1A1A1A] mb-2">Permanent Bans</h3>
                                <p className="text-sm text-[#6B6B6B]">Severe safety violations, fraud, impersonation, or illegal activity result in immediate and permanent account termination.</p>
                            </div>
                        </div>
                        <p className="text-[#6B6B6B] leading-relaxed mt-4">
                            You may terminate your account at any time through your account settings or by contacting us. We may terminate or suspend your access immediately, without prior notice or liability, for any reason, including breach of these Terms.
                        </p>
                    </section>

                    {/* 7. Disclaimers */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">7. Disclaimers</h2>
                        <p className="text-[#6B6B6B] leading-relaxed">
                            THE SERVICE IS PROVIDED ON AN &quot;AS-IS&quot; AND &quot;AS-AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE. WE MAKE NO WARRANTIES REGARDING THE ACCURACY, RELIABILITY, OR COMPLETENESS OF ANY USER-GENERATED CONTENT. WE DO NOT GUARANTEE FUNCTIONALITY ON ALL NETWORKS, INCLUDING RESTRICTED CAMPUS OR GUEST WI-FI. WE ARE NOT RESPONSIBLE FOR THE CONDUCT OF ANY USER, WHETHER ONLINE OR OFFLINE.
                        </p>
                    </section>

                    {/* 8. Limitation of Liability */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">8. Limitation of Liability</h2>
                        <p className="text-[#6B6B6B] leading-relaxed">
                            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL DEBUG DRAGONS LLC, ITS OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR IN CONNECTION WITH YOUR ACCESS TO OR USE OF (OR INABILITY TO ACCESS OR USE) THE SERVICE, ANY CONDUCT OR CONTENT OF ANY USER OR THIRD PARTY ON THE SERVICE, OR UNAUTHORIZED ACCESS, USE, OR ALTERATION OF YOUR CONTENT. OUR TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED THE GREATER OF ONE HUNDRED U.S. DOLLARS ($100.00) OR THE AMOUNT YOU PAID US, IF ANY, IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
                        </p>
                    </section>

                    {/* 9. Indemnification */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">9. Indemnification</h2>
                        <p className="text-[#6B6B6B] leading-relaxed">
                            You agree to indemnify, defend, and hold harmless Debug Dragons LLC and its officers, directors, employees, and agents from and against any and all claims, damages, obligations, losses, liabilities, costs, and expenses (including reasonable attorneys&apos; fees) arising from: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any third-party right, including any intellectual property, privacy, or proprietary right; or (d) any User Content you post or share through the Service.
                        </p>
                    </section>

                    {/* 10. Dispute Resolution & Governing Law */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">10. Dispute Resolution & Governing Law</h2>
                        <p className="text-[#6B6B6B] leading-relaxed mb-4">
                            These Terms shall be governed by and construed in accordance with the laws of the State of New York, United States, without regard to its conflict of law provisions.
                        </p>
                        <p className="text-[#6B6B6B] leading-relaxed">
                            Any dispute arising out of or relating to these Terms or the Service shall first be attempted to be resolved through good-faith negotiation. If the dispute cannot be resolved within thirty (30) days of written notice, either party may pursue resolution through binding arbitration administered in accordance with the rules of the American Arbitration Association, or through the state or federal courts located in New York County, New York. You waive any right to participate in a class action lawsuit or class-wide arbitration.
                        </p>
                    </section>

                    {/* 11. Changes to These Terms */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">11. Changes to These Terms</h2>
                        <p className="text-[#6B6B6B] leading-relaxed">
                            We reserve the right to modify these Terms at any time. When we make material changes, we will update the &quot;Last Updated&quot; date at the top of this page and notify you through the Service or via email. Your continued use of the Service after any changes constitutes acceptance of the revised Terms. If you do not agree to the updated Terms, you must stop using the Service and delete your account.
                        </p>
                    </section>

                    {/* 12. Contact */}
                    <section>
                        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">12. Contact</h2>
                        <p className="text-[#6B6B6B] mb-4">
                            For legal inquiries, reports of violations, or questions about these Terms:
                        </p>
                        <div className="bg-[#FAF9F7] p-6 rounded-2xl border border-[#E5E5E5]">
                            <p className="font-bold text-[#1A1A1A] mb-1">Debug Dragons LLC — Campustry Legal</p>
                            <a href="mailto:debugdragons4@gmail.com" className="text-[#2D5A47] hover:underline">debugdragons4@gmail.com</a>
                        </div>
                    </section>

                </div>
            </div>

            <Footer />
        </main>
    );
}
