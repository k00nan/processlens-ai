import streamlit as st


def show():
    st.markdown("""
    <style>
        [data-testid="stFileUploaderDropzone"] {
            border: 2px dashed #b39ddb;
            border-radius: 12px;
            background-color: #faf9fe;
        }
        [data-testid="stFileUploaderDropzone"] button {
            background-color: #ede7f6;
            color: #5e35b1;
            border: 1px solid #b39ddb;
            border-radius: 8px;
        }
        [data-testid="stFileUploaderDropzone"] small,
        [data-testid="stFileUploaderDropzone"] span {
            color: #5e35b1;
        }
    </style>
    """, unsafe_allow_html=True)

    st.title("Upload")
    st.write("Laden Sie Ihren Event Log (CSV) hoch und ordnen Sie die Spalten zu.")

    uploaded_file = st.file_uploader(
        "CSV-Datei hierher ziehen oder auswählen",
        type=["csv"],
    )

    if uploaded_file:
        st.success(f"Datei erfolgreich geladen: {uploaded_file.name}")
