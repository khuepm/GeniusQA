"""Property-based tests for schema validation."""

import pytest
from hypothesis import given, strategies as st
from pathlib import Path
import tempfile

from .storage import Storage


# Feature: desktop-recorder-mvp, Property 11: Schema validation rejects invalid files
@given(st.dictionaries(
    keys=st.text(min_size=1, max_size=20),
    values=st.one_of(
        st.none(),
        st.booleans(),
        st.integers(),
        st.floats(allow_nan=False, allow_infinity=False),
        st.text(),
        st.lists(st.integers())
    ),
    min_size=1,
    max_size=10
))
def test_schema_validation_rejects_invalid_files(invalid_data):
    """For any JSON file that does not conform to the script file schema, 
    the validation function should reject it and return a clear error message.
    
    Validates: Requirements 3.5, 9.3
    """
    storage = Storage()
    
    # Validate the invalid data
    is_valid, error_message = storage.validate_script(invalid_data)
    
    # Should reject invalid data
    assert is_valid is False
    assert error_message is not None
    assert len(error_message) > 0


@given(st.dictionaries(
    keys=st.just("metadata"),
    values=st.dictionaries(
        keys=st.text(min_size=1, max_size=20),
        values=st.one_of(st.none(), st.text(), st.integers()),
        min_size=1,
        max_size=5
    ),
    min_size=1,
    max_size=1
))
def test_schema_validation_rejects_missing_actions(data_with_metadata_only):
    """Schema validation should reject files missing the actions field."""
    storage = Storage()
    
    is_valid, error_message = storage.validate_script(data_with_metadata_only)
    
    assert is_valid is False
    assert error_message is not None


@given(st.dictionaries(
    keys=st.just("actions"),
    values=st.lists(st.dictionaries(
        keys=st.text(min_size=1, max_size=20),
        values=st.one_of(st.none(), st.text(), st.integers()),
        min_size=1,
        max_size=5
    ), min_size=1, max_size=5),
    min_size=1,
    max_size=1
))
def test_schema_validation_rejects_missing_metadata(data_with_actions_only):
    """Schema validation should reject files missing the metadata field."""
    storage = Storage()
    
    is_valid, error_message = storage.validate_script(data_with_actions_only)
    
    assert is_valid is False
    assert error_message is not None


@given(st.dictionaries(
    keys=st.sampled_from(["metadata", "actions"]),
    values=st.one_of(
        st.dictionaries(
            keys=st.sampled_from(["type", "timestamp"]),
            values=st.one_of(
                st.just("invalid_type"),  # Invalid action type
                st.floats(min_value=-1000, max_value=-1),  # Negative timestamp
                st.text(min_size=1, max_size=10)
            ),
            min_size=1,
            max_size=2
        ),
        st.lists(st.dictionaries(
            keys=st.sampled_from(["type", "timestamp"]),
            values=st.one_of(
                st.just("invalid_type"),
                st.floats(min_value=-1000, max_value=-1),
                st.text(min_size=1, max_size=10)
            ),
            min_size=1,
            max_size=2
        ), min_size=1, max_size=3)
    ),
    min_size=2,
    max_size=2
))
def test_schema_validation_rejects_invalid_field_values(data_with_invalid_values):
    """Schema validation should reject files with invalid field values."""
    storage = Storage()
    
    is_valid, error_message = storage.validate_script(data_with_invalid_values)
    
    assert is_valid is False
    assert error_message is not None
