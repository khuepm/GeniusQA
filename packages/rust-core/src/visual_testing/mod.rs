//! Visual Regression Testing Module
//! 
//! This module provides high-performance image comparison and visual regression testing
//! capabilities for the GeniusQA automation platform.

pub mod models;
pub mod comparator;
pub mod error;
pub mod image_loader;
pub mod screen_capture;
pub mod storage;
pub mod compression;
pub mod ipc_server;
pub mod html_report;

#[cfg(test)]
pub mod property_tests;

#[cfg(test)]
mod test_pixelmatch;

#[cfg(test)]
mod benchmark_pixelmatch;

#[cfg(test)]
mod storage_tests;

#[cfg(test)]
mod simple_tests;

pub use models::*;
pub use comparator::*;
pub use error::*;
pub use image_loader::*;
pub use screen_capture::*;
pub use storage::*;
pub use compression::*;
pub use ipc_server::*;
pub use html_report::*;
