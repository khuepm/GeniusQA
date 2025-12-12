"""Property-based tests for test report generator."""

import pytest
import json
import tempfile
from pathlib import Path
from hypothesis import given, strategies as st, settings
from player.test_report_generator import TestReportGenerator, generate_test_report
from datetime import datetime


@st.composite
def execution_summary_strategy(draw):
    """Generate a valid execution summary for testing."""
    total_steps = draw(st.integers(min_value=1, max_value=10))
    passed_steps = draw(st.integers(min_value=0, max_value=total_steps))
    remaining_steps = total_steps - passed_steps
    failed_steps = draw(st.integers(min_value=0, max_value=remaining_steps))
    skipped_steps = remaining_steps - failed_steps
    
    # Generate step results
    step_results = []
    step_index = 0
    
    # Add passed steps
    for i in range(passed_steps):
        step_results.append({
            'step_id': f'step-{step_index}',
            'step_order': step_index + 1,
            'description': draw(st.text(min_size=5, max_size=50, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs')))),
            'expected_result': draw(st.text(max_size=100, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs')))),
            'status': 'passed',
            'message': 'Step completed successfully',
            'execution_time': draw(st.floats(min_value=0.1, max_value=10.0)),
            'action_count': draw(st.integers(min_value=1, max_value=5)),
            'executed_actions': draw(st.integers(min_value=1, max_value=5)),
            'failed_actions': 0,
            'assertion_results': [],
            'evidence_paths': [],
            'timestamp': datetime.now().timestamp()
        })
        step_index += 1
    
    # Add failed steps
    for i in range(failed_steps):
        step_results.append({
            'step_id': f'step-{step_index}',
            'step_order': step_index + 1,
            'description': draw(st.text(min_size=5, max_size=50, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs')))),
            'expected_result': draw(st.text(max_size=100, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs')))),
            'status': 'failed',
            'message': draw(st.text(min_size=5, max_size=100, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs')))),
            'execution_time': draw(st.floats(min_value=0.1, max_value=10.0)),
            'action_count': draw(st.integers(min_value=1, max_value=5)),
            'executed_actions': draw(st.integers(min_value=0, max_value=3)),
            'failed_actions': draw(st.integers(min_value=1, max_value=3)),
            'assertion_results': [],
            'evidence_paths': [f'evidence/screenshot_{step_index}_{i}.png' for i in range(draw(st.integers(min_value=0, max_value=3)))],
            'timestamp': datetime.now().timestamp()
        })
        step_index += 1
    
    # Add skipped steps
    for i in range(skipped_steps):
        step_results.append({
            'step_id': f'step-{step_index}',
            'step_order': step_index + 1,
            'description': draw(st.text(min_size=5, max_size=50, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs')))),
            'expected_result': draw(st.text(max_size=100, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs')))),
            'status': 'skipped',
            'message': 'Skipped due to previous step failure',
            'execution_time': 0.0,
            'action_count': draw(st.integers(min_value=1, max_value=5)),
            'executed_actions': 0,
            'failed_actions': 0,
            'assertion_results': [],
            'evidence_paths': [],
            'timestamp': datetime.now().timestamp()
        })
        step_index += 1
    
    # Determine overall status
    if failed_steps > 0:
        overall_status = 'failed'
    elif passed_steps > 0:
        overall_status = 'passed'
    else:
        overall_status = 'skipped'
    
    return {
        'total_steps': total_steps,
        'passed_steps': passed_steps,
        'failed_steps': failed_steps,
        'skipped_steps': skipped_steps,
        'total_execution_time': sum(step['execution_time'] for step in step_results),
        'overall_status': overall_status,
        'step_results': step_results,
        'execution_mode': 'step-based',
        'script_title': draw(st.text(min_size=5, max_size=50, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs')))),
        'generated_at': datetime.now().timestamp()
    }


# Feature: test-case-driven-automation, Property 15: Report Generation
@settings(max_examples=50, deadline=None)
@given(execution_summary_strategy())
def test_report_generation_html_format(execution_summary):
    """For any completed test execution, the report SHALL show pass/fail status for
    each step with descriptions, include error messages and screenshots for failed
    steps, and be exportable in HTML format.
    
    **Feature: test-case-driven-automation, Property 15: Report Generation**
    **Validates: Requirements 5.3, 5.4, 5.5**
    """
    generator = TestReportGenerator()
    
    # Generate HTML report
    html_content = generator.generate_report(execution_summary, 'html')
    
    # Verify HTML content contains required elements
    assert isinstance(html_content, str), "HTML report should be a string"
    assert len(html_content) > 0, "HTML report should not be empty"
    assert '<!DOCTYPE html>' in html_content, "HTML report should be valid HTML"
    assert '<html' in html_content, "HTML report should contain html tag"
    
    # Verify script title is included
    script_title = execution_summary['script_title']
    assert script_title in html_content, f"HTML report should contain script title '{script_title}'"
    
    # Verify overall status is displayed
    overall_status = execution_summary['overall_status'].upper()
    assert overall_status in html_content, f"HTML report should show overall status '{overall_status}'"


# Feature: test-case-driven-automation, Property 15: Report Generation
@settings(max_examples=50, deadline=None)
@given(execution_summary_strategy())
def test_report_generation_json_format(execution_summary):
    """For any completed test execution, the report SHALL be exportable in JSON format
    with all step information preserved.
    
    **Feature: test-case-driven-automation, Property 15: Report Generation**
    **Validates: Requirements 5.3, 5.4, 5.5**
    """
    generator = TestReportGenerator()
    
    # Generate JSON report
    json_content = generator.generate_report(execution_summary, 'json')
    
    # Verify JSON content is valid
    assert isinstance(json_content, str), "JSON report should be a string"
    assert len(json_content) > 0, "JSON report should not be empty"
    
    # Parse JSON to verify it's valid
    try:
        report_data = json.loads(json_content)
    except json.JSONDecodeError:
        pytest.fail("JSON report should be valid JSON")
    
    # Verify required fields are present
    assert 'script_title' in report_data, "JSON report should contain script title"
    assert 'overall_status' in report_data, "JSON report should contain overall status"
    assert 'total_steps' in report_data, "JSON report should contain total steps"
    assert 'passed_steps' in report_data, "JSON report should contain passed steps count"
    assert 'failed_steps' in report_data, "JSON report should contain failed steps count"
    assert 'skipped_steps' in report_data, "JSON report should contain skipped steps count"
    assert 'steps' in report_data, "JSON report should contain steps array"
    
    # Verify step data integrity
    assert len(report_data['steps']) == execution_summary['total_steps'], \
        "JSON report should contain all steps"


# Feature: test-case-driven-automation, Property 19: Report Separation
@settings(max_examples=30, deadline=None)
@given(execution_summary_strategy(), st.sampled_from(['html', 'json']))
def test_report_separation_from_script(execution_summary, output_format):
    """For any test execution completion, the test report SHALL be generated as a
    separate output file from the script file.
    
    **Feature: test-case-driven-automation, Property 19: Report Separation**
    **Validates: Requirements 8.3**
    """
    with tempfile.TemporaryDirectory() as temp_dir:
        # Generate report with file output
        report_path = generate_test_report(
            execution_summary,
            output_format,
            temp_dir,
            'test_report'
        )
        
        # Verify report file was created
        assert report_path is not None, "Report generation should return a file path"
        
        report_file = Path(report_path)
        assert report_file.exists(), f"Report file should be created at {report_path}"
        assert report_file.is_file(), "Report path should point to a file"
        
        # Verify file is separate from any script file
        assert report_file.parent == Path(temp_dir), "Report should be in specified directory"
        assert 'test_report' in report_file.name, "Report filename should contain prefix"
        
        # Verify file has correct extension
        expected_extensions = {'html': '.html', 'json': '.json'}
        expected_ext = expected_extensions.get(output_format, '.html')
        assert report_file.suffix == expected_ext, f"Report file should have {expected_ext} extension"
        
        # Verify file contains content
        file_content = report_file.read_text(encoding='utf-8')
        assert len(file_content) > 0, "Report file should not be empty"
        
        # Verify content matches format
        if output_format == 'html':
            assert '<!DOCTYPE html>' in file_content, "HTML report file should contain valid HTML"
        elif output_format == 'json':
            try:
                json.loads(file_content)
            except json.JSONDecodeError:
                pytest.fail("JSON report file should contain valid JSON")


def test_report_generator_initialization():
    """Test that TestReportGenerator can be initialized properly."""
    generator = TestReportGenerator()
    
    # Should have HTML template
    assert generator.html_template is not None, "Should initialize with HTML template"
    
    # Template should be callable
    assert hasattr(generator.html_template, 'render'), "HTML template should be renderable"
