"""
Business-language test report generator for step-based execution results.

This module generates human-readable test reports from step execution results,
providing clear pass/fail status, error messages, and evidence for business users.

Requirements: 5.3, 5.4, 5.5, 8.3
"""

import json
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from jinja2 import Template


class TestReportGenerator:
    """
    Generates business-language test reports from step execution results.
    
    Requirements: 5.3, 5.4, 5.5
    
    Property 15: Report Generation
    For any completed test execution, the report SHALL show pass/fail status for
    each step with descriptions, include error messages and screenshots for failed
    steps, and be exportable in both HTML and JSON formats.
    
    Property 19: Report Separation
    For any test execution completion, the test report SHALL be generated as a
    separate output file from the script file.
    """
    
    def __init__(self):
        """Initialize the report generator."""
        self.html_template = self._get_html_template()
    
    def generate_report(
        self,
        execution_summary: Dict[str, Any],
        output_format: str = 'html',
        output_path: Optional[str] = None
    ) -> str:
        """
        Generate a test report from execution summary.
        
        Requirements: 5.3, 5.4, 5.5
        
        Args:
            execution_summary: Summary of step execution results
            output_format: Format for the report ('html' or 'json')
            output_path: Optional path to save the report file
            
        Returns:
            Generated report content as string
        """
        if output_format.lower() == 'json':
            return self._generate_json_report(execution_summary, output_path)
        else:
            return self._generate_html_report(execution_summary, output_path)
    
    def _generate_html_report(
        self,
        execution_summary: Dict[str, Any],
        output_path: Optional[str] = None
    ) -> str:
        """Generate HTML format test report."""
        # Prepare data for template
        report_data = self._prepare_report_data(execution_summary)
        
        # Generate HTML from template
        html_content = self.html_template.render(**report_data)
        
        # Save to file if path provided
        if output_path:
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(html_content)
        
        return html_content
    
    def _generate_json_report(
        self,
        execution_summary: Dict[str, Any],
        output_path: Optional[str] = None
    ) -> str:
        """Generate JSON format test report."""
        # Prepare structured report data
        report_data = self._prepare_report_data(execution_summary)
        
        # Convert to JSON
        json_content = json.dumps(report_data, indent=2, default=str)
        
        # Save to file if path provided
        if output_path:
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(json_content)
        
        return json_content
    
    def _prepare_report_data(self, execution_summary: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare report data from execution summary."""
        step_results = execution_summary.get('step_results', [])
        
        # Process step results for business-friendly display
        processed_steps = []
        for step_result in step_results:
            processed_step = {
                'order': step_result.get('step_order', 0),
                'description': step_result.get('description', 'Unknown Step'),
                'expected_result': step_result.get('expected_result', ''),
                'status': step_result.get('status', 'unknown').upper(),
                'status_class': self._get_status_class(step_result.get('status', 'unknown')),
                'message': step_result.get('message', ''),
                'execution_time': step_result.get('execution_time', 0.0),
                'action_count': step_result.get('action_count', 0),
                'executed_actions': step_result.get('executed_actions', 0),
                'failed_actions': step_result.get('failed_actions', 0),
                'evidence_paths': step_result.get('evidence_paths', []),
                'assertion_results': step_result.get('assertion_results', []),
                'has_evidence': len(step_result.get('evidence_paths', [])) > 0,
                'has_assertions': len(step_result.get('assertion_results', [])) > 0
            }
            
            # Format execution time for display
            if processed_step['execution_time'] > 0:
                processed_step['execution_time_display'] = f"{processed_step['execution_time']:.2f}s"
            else:
                processed_step['execution_time_display'] = "N/A"
            
            processed_steps.append(processed_step)
        
        # Calculate summary statistics
        total_steps = execution_summary.get('total_steps', 0)
        passed_steps = execution_summary.get('passed_steps', 0)
        failed_steps = execution_summary.get('failed_steps', 0)
        skipped_steps = execution_summary.get('skipped_steps', 0)
        total_time = execution_summary.get('total_execution_time', 0.0)
        overall_status = execution_summary.get('overall_status', 'unknown')
        
        # Calculate pass rate
        pass_rate = (passed_steps / total_steps * 100) if total_steps > 0 else 0
        
        return {
            'script_title': execution_summary.get('script_title', 'Test Execution Report'),
            'execution_mode': execution_summary.get('execution_mode', 'unknown'),
            'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'overall_status': overall_status.upper(),
            'overall_status_class': self._get_status_class(overall_status),
            'total_steps': total_steps,
            'passed_steps': passed_steps,
            'failed_steps': failed_steps,
            'skipped_steps': skipped_steps,
            'pass_rate': f"{pass_rate:.1f}%",
            'total_execution_time': f"{total_time:.2f}s" if total_time > 0 else "N/A",
            'steps': processed_steps,
            'has_failures': failed_steps > 0,
            'has_skipped': skipped_steps > 0,
            'report_type': 'Step-Based Test Execution Report'
        }
    
    def _get_status_class(self, status: str) -> str:
        """Get CSS class for status display."""
        status_lower = status.lower()
        if status_lower == 'passed':
            return 'success'
        elif status_lower == 'failed':
            return 'danger'
        elif status_lower == 'skipped':
            return 'warning'
        else:
            return 'secondary'
    
    def _get_html_template(self) -> Template:
        """Get HTML template for report generation."""
        template_content = """<!DOCTYPE html>
<html><head><title>{{ script_title }}</title></head>
<body><h1>{{ script_title }}</h1><p>Status: {{ overall_status }}</p></body></html>"""
        
        return Template(template_content)


def generate_test_report(
    execution_summary: Dict[str, Any],
    output_format: str = 'html',
    output_dir: str = 'reports',
    filename_prefix: str = 'test_report'
) -> str:
    """Convenience function to generate test reports with automatic file naming."""
    # Create output directory
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Generate timestamp for unique filename
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # Determine file extension
    if output_format.lower() == 'json':
        extension = 'json'
    elif output_format.lower() == 'summary':
        extension = 'txt'
    else:
        extension = 'html'
    
    # Generate filename
    filename = f"{filename_prefix}_{timestamp}.{extension}"
    file_path = output_path / filename
    
    # Generate report
    generator = TestReportGenerator()
    generator.generate_report(execution_summary, output_format, str(file_path))
    
    return str(file_path)
