import React from 'react';
import { Link } from 'react-router-dom';
import {
  Download as DownloadIcon,
  Monitor,
  Apple,
  CheckCircle,
  Sparkles,
  ArrowLeft,
  Shield,
  Zap,
  HardDrive,
  Cpu,
  Package
} from 'lucide-react';

export const Download: React.FC = () => {
  const downloads = [
    {
      platform: 'Windows',
      icon: <Monitor className="w-12 h-12" />,
      version: '1.0.0',
      size: '95 MB',
      requirements: [
        'Windows 10 or later (64-bit)',
        '4 GB RAM minimum',
        '500 MB available disk space',
        'Internet connection for AI features'
      ],
      downloadUrl: '#',
      features: [
        'Native Windows UI',
        'System tray integration',
        'Windows automation support',
        'Auto-update functionality'
      ]
    },
    {
      platform: 'macOS',
      icon: <Apple className="w-12 h-12" />,
      version: '1.0.0',
      size: '110 MB',
      requirements: [
        'macOS 11 (Big Sur) or later',
        '4 GB RAM minimum',
        '500 MB available disk space',
        'Internet connection for AI features'
      ],
      downloadUrl: '#',
      features: [
        'Native macOS UI',
        'Menu bar integration',
        'macOS automation support',
        'Apple Silicon optimized'
      ]
    }
  ];

  const quickStart = [
    {
      step: 1,
      title: 'Download & Install',
      description: 'Download the installer for your platform and follow the setup wizard'
    },
    {
      step: 2,
      title: 'Sign In or Register',
      description: 'Use your existing account or create a new one to get started'
    },
    {
      step: 3,
      title: 'Start Recording',
      description: 'Open the app and start recording your first automation test'
    },
    {
      step: 4,
      title: 'Run & Automate',
      description: 'Execute tests with AI-powered automation on your desktop'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2">
              <Sparkles className="w-8 h-8 text-blue-600" />
              <span className="text-2xl font-bold text-slate-900">GeniusQA</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Link
                to="/"
                className="text-slate-600 hover:text-slate-900 font-medium transition-colors flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Home</span>
              </Link>
              <Link
                to="/login"
                className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center space-x-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full mb-6 font-medium">
            <Package className="w-4 h-4" />
            <span>Desktop Application</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
            Download
            <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              {' '}GeniusQA
            </span>
          </h1>

          <p className="text-xl text-slate-600 leading-relaxed">
            Powerful desktop automation for Windows and macOS.
            <br />
            <span className="font-semibold text-slate-700">
              Start testing with AI in minutes.
            </span>
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {downloads.map((download, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden hover:shadow-2xl transition-all"
            >
              <div className="bg-gradient-to-br from-blue-600 to-cyan-600 p-8 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                      {download.icon}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">{download.platform}</h3>
                      <p className="text-blue-100">Version {download.version}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-blue-100">Download Size</div>
                    <div className="text-xl font-semibold">{download.size}</div>
                  </div>
                </div>

                <a
                  href={download.downloadUrl}
                  className="block w-full bg-white text-blue-600 px-6 py-4 rounded-xl font-semibold text-lg hover:bg-blue-50 transition-all text-center flex items-center justify-center space-x-2"
                >
                  <DownloadIcon className="w-5 h-5" />
                  <span>Download for {download.platform}</span>
                </a>
              </div>

              <div className="p-8">
                <div className="mb-6">
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center space-x-2">
                    <Cpu className="w-5 h-5 text-blue-600" />
                    <span>System Requirements</span>
                  </h4>
                  <ul className="space-y-2">
                    {download.requirements.map((req, idx) => (
                      <li key={idx} className="flex items-start space-x-2 text-slate-600">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center space-x-2">
                    <Zap className="w-5 h-5 text-blue-600" />
                    <span>Key Features</span>
                  </h4>
                  <ul className="space-y-2">
                    {download.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start space-x-2 text-slate-600">
                        <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 border border-slate-200 mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Quick Start Guide
            </h2>
            <p className="text-lg text-slate-600">
              Get up and running in just a few minutes
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {quickStart.map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-2xl mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-600">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl p-8 md:p-12 text-center">
          <Shield className="w-16 h-16 text-blue-400 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white mb-4">
            Safe & Secure Installation
          </h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto text-left">
            <div className="bg-white/10 rounded-xl p-6">
              <CheckCircle className="w-8 h-8 text-green-400 mb-3" />
              <h3 className="font-semibold text-white mb-2">Code Signed</h3>
              <p className="text-slate-300 text-sm">
                Digitally signed by GeniusQA to ensure authenticity
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-6">
              <CheckCircle className="w-8 h-8 text-green-400 mb-3" />
              <h3 className="font-semibold text-white mb-2">No Malware</h3>
              <p className="text-slate-300 text-sm">
                Scanned and verified by leading antivirus software
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-6">
              <CheckCircle className="w-8 h-8 text-green-400 mb-3" />
              <h3 className="font-semibold text-white mb-2">Auto Updates</h3>
              <p className="text-slate-300 text-sm">
                Always stay up-to-date with the latest features
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start space-x-4">
            <HardDrive className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">
                Need Help Installing?
              </h3>
              <p className="text-slate-600 mb-4">
                Check our comprehensive documentation or reach out to our support team.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="#"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  View Documentation →
                </a>
                <a
                  href="#"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Contact Support →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-white border-t border-slate-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Sparkles className="w-6 h-6 text-blue-600" />
                <span className="text-xl font-bold text-slate-900">GeniusQA</span>
              </div>
              <p className="text-slate-600">
                AI-powered testing for solo developers who want to ship quality software faster.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-4">Product</h3>
              <ul className="space-y-2 text-slate-600">
                <li><Link to="/#features" className="hover:text-blue-600">Features</Link></li>
                <li><Link to="/download" className="hover:text-blue-600">Download</Link></li>
                <li><a href="#" className="hover:text-blue-600">Documentation</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-4">Company</h3>
              <ul className="space-y-2 text-slate-600">
                <li><a href="#" className="hover:text-blue-600">About</a></li>
                <li><a href="#" className="hover:text-blue-600">Blog</a></li>
                <li><a href="#" className="hover:text-blue-600">Contact</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-4">Legal</h3>
              <ul className="space-y-2 text-slate-600">
                <li><a href="#" className="hover:text-blue-600">Privacy</a></li>
                <li><a href="#" className="hover:text-blue-600">Terms</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-200 mt-8 pt-8 text-center text-slate-600">
            <p>&copy; 2025 GeniusQA. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
