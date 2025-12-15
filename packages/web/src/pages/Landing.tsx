import React from 'react';
import { Link } from 'react-router-dom';
import {
  Rocket,
  Zap,
  Shield,
  Code,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Target,
  TrendingUp,
  Github
} from 'lucide-react';

export const Landing: React.FC = () => {
  const features = [
    {
      icon: <Zap className="w-8 h-8" />,
      title: 'AI-Powered Test Generation',
      description: 'Automatically generate comprehensive test cases from your application. No more manual test writing.'
    },
    {
      icon: <Code className="w-8 h-8" />,
      title: 'Desktop Automation',
      description: 'Test your Windows and macOS applications with intelligent desktop agents. Real user simulation.'
    },
    {
      icon: <Target className="w-8 h-8" />,
      title: 'Smart Test Management',
      description: 'Organize, track, and execute tests across multiple projects. Everything in one place.'
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: 'Cloud Integration',
      description: 'Seamlessly connect with Google Docs, Sheets, and other cloud services for collaborative testing.'
    }
  ];

  const benefits = [
    'Save 10+ hours per week on manual testing',
    'Ship faster with confidence',
    'Catch bugs before your users do',
    'Scale your testing without scaling your team',
    'Focus on building features, not writing tests',
    'Professional QA results without the overhead'
  ];

  const testimonials = [
    {
      quote: 'As a solo developer, GeniusQA gave me the confidence to ship quality products without hiring a QA team.',
      author: 'Independent Developer',
      role: 'Building SaaS Products'
    },
    {
      quote: 'I went from spending 2 days testing each release to just a few hours. The AI test generation is incredible.',
      author: 'Startup Founder',
      role: 'Desktop App Creator'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-8 h-8 text-blue-600" />
              <span className="text-2xl font-bold text-slate-900">GeniusQA</span>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="https://github.com/khuepm/GeniusQA"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 hover:text-slate-900 transition-colors"
                aria-label="GitHub Repository"
              >
                <Github className="w-6 h-6" />
              </a>
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

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center space-x-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full mb-6 font-medium">
            <Rocket className="w-4 h-4" />
            <span>Built for Solo Developers</span>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 mb-6 leading-tight">
            Test Like a Team.
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Ship Like a Pro.
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-slate-600 mb-8 leading-relaxed">
            You don't need a QA team to deliver quality software.
            <br />
            <span className="font-semibold text-slate-700">
              GeniusQA is your AI-powered testing partner.
            </span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              to="/register"
              className="group bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-all shadow-xl hover:shadow-2xl flex items-center space-x-2"
            >
              <span>Start Testing for Free</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#features"
              className="text-slate-700 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white/50 transition-all"
            >
              See How It Works
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-slate-500">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>Free forever plan</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 border border-slate-200">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              The Reality of Solo Development
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              You're building, deploying, marketing, and supporting your product.
              <span className="block mt-2 font-semibold text-slate-700">
                Testing shouldn't slow you down.
              </span>
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="text-center p-6">
              <div className="text-4xl font-bold text-red-600 mb-2">60%</div>
              <p className="text-slate-600">of solo developers skip proper testing due to time constraints</p>
            </div>
            <div className="text-center p-6">
              <div className="text-4xl font-bold text-orange-600 mb-2">10+ hrs</div>
              <p className="text-slate-600">spent weekly on manual testing instead of building features</p>
            </div>
            <div className="text-center p-6">
              <div className="text-4xl font-bold text-blue-600 mb-2">5x</div>
              <p className="text-slate-600">faster shipping with automated AI-powered testing</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Everything You Need to Test with Confidence
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Professional-grade testing tools designed for developers who work solo
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-all border border-slate-200 hover:border-blue-300"
            >
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl shadow-2xl p-8 md:p-12">
          <div className="max-w-3xl mx-auto text-center text-white">
            <Shield className="w-16 h-16 mx-auto mb-6 opacity-90" />
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ship Without Fear
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Every release should feel confident, not stressful. With GeniusQA, you get:
            </p>
            <div className="grid md:grid-cols-2 gap-4 text-left">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
                  <span className="text-lg">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Trusted by Solo Developers Worldwide
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-8 shadow-lg border border-slate-200"
            >
              <p className="text-lg text-slate-700 mb-6 italic">
                "{testimonial.quote}"
              </p>
              <div>
                <div className="font-semibold text-slate-900">{testimonial.author}</div>
                <div className="text-slate-600 text-sm">{testimonial.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-slate-900 rounded-2xl shadow-2xl p-8 md:p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Level Up Your Testing?
          </h2>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Join solo developers who are shipping faster and sleeping better.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center space-x-2 bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-all shadow-xl hover:shadow-2xl"
          >
            <span>Start Your Free Account</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-slate-400 mt-4">No credit card required. Start testing in minutes.</p>
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
                <li><a href="#features" className="hover:text-blue-600">Features</a></li>
                <li><a href="#" className="hover:text-blue-600">Pricing</a></li>
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
