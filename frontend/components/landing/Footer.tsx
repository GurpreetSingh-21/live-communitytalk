import Link from "next/link";
import Image from "next/image";

export function Footer() {
    return (
        <footer className="bg-gradient-to-b from-white to-[#FAF9F7] border-t border-[#E5E5E5] py-16 relative overflow-hidden">
            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(45,90,71,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(45,90,71,0.03)_1px,transparent_1px)] bg-[size:64px_64px] opacity-50" />

            <div className="container mx-auto px-6 relative z-10">
                <div className="flex flex-col items-center gap-12 mb-12">
                    {/* Brand */}
                    <div className="text-center">
                        <Link href="/" className="flex flex-col items-center gap-4 group">
                            <div className="relative w-16 h-16">
                                <Image
                                    src="/logo.png"
                                    alt="Campustry"
                                    fill
                                    className="object-contain"
                                />
                            </div>
                            <span className="text-2xl font-bold text-[#2D5A47]">
                                Campustry
                            </span>
                        </Link>
                        <p className="text-[#6B6B6B] leading-relaxed max-w-md mt-4">
                            Where Campus Meets Chemistry. The verified student platform connecting communities across the nation.
                        </p>
                    </div>

                    {/* Social Icons */}
                    <div className="flex items-center gap-4">
                        <a href="#" className="w-12 h-12 flex items-center justify-center rounded-full bg-[#2D5A47]/5 hover:bg-[#2D5A47]/10 text-[#2D5A47] transition-colors">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                            </svg>
                        </a>
                        <a href="#" className="w-12 h-12 flex items-center justify-center rounded-full bg-[#2D5A47]/5 hover:bg-[#2D5A47]/10 text-[#2D5A47] transition-colors">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z" />
                                <circle cx="12" cy="12" r="3.5" />
                            </svg>
                        </a>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-center items-center gap-6 pt-8 border-t border-[#E5E5E5]">
                    <p className="text-sm text-[#6B6B6B]">
                        &copy; {new Date().getFullYear()} Campustry. All rights reserved.
                    </p>

                    <div className="flex items-center gap-6">
                        <Link href="#" className="text-sm text-[#6B6B6B] hover:text-[#2D5A47] transition-colors">
                            Privacy Policy
                        </Link>
                        <Link href="#" className="text-sm text-[#6B6B6B] hover:text-[#2D5A47] transition-colors">
                            Terms of Service
                        </Link>
                        <Link href="#" className="text-sm text-[#6B6B6B] hover:text-[#2D5A47] transition-colors">
                            Contact
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
