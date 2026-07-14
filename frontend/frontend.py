import streamlit as st
from pages import upload

from pathlib import Path

logo_path = str(Path(__file__).resolve().parent.parent / "img" / "Logo.png")

st.set_page_config(page_title="ProcessLens AI", page_icon=logo_path)

col1, col2 = st.sidebar.columns([1, 3])
with col1:
    st.image(logo_path, width=45)
with col2:
    st.markdown(
        '<p style="font-size:1.2rem;font-weight:bold;color:white;margin-top:-2rem;">ProcessLens AI</p>',
        unsafe_allow_html=True,
    )

pages = ["Upload", "Übersicht", "Prozessanalyse", "KI-Auswertung"]
icons = [":material/cloud_upload:", ":material/home:", ":material/show_chart:", ":material/chat:"]

if "page" not in st.session_state:
    st.session_state.page = pages[0]

for i, p in enumerate(pages):
    is_active = st.session_state.page == p
    btn_type = "primary" if is_active else "secondary"
    if st.sidebar.button(p, key=f"nav_{p}", icon=icons[i], use_container_width=True, type=btn_type):
        st.session_state.page = p
        st.rerun()

st.markdown("""
<style>
section[data-testid="stSidebar"] [data-testid="stImage"] {
        margin-top: -2.3rem !important;
    }
    section[data-testid="stSidebar"] button[kind="secondary"] {
        border: none !important;
        background-color: transparent !important;
        color: white !important;
        text-align: left;
    }
    section[data-testid="stSidebar"] button[kind="secondary"]:hover {
        background-color: rgba(81, 33, 230, 0.2) !important;
        color: white !important;
    }
    section[data-testid="stSidebar"] button[kind="secondary"]:focus,
    section[data-testid="stSidebar"] button[kind="secondary"]:active {
        color: white !important;
        border: none !important;
        background-color: transparent !important;
    }
    section[data-testid="stSidebar"] button[kind="primary"],
    section[data-testid="stSidebar"] button[kind="primary"]:hover,
    section[data-testid="stSidebar"] button[kind="primary"]:focus,
    section[data-testid="stSidebar"] button[kind="primary"]:active {
        color: white !important;
        border: none !important;
        border-radius: 8px;
    }
</style>
""", unsafe_allow_html=True)

page = st.session_state.page

if page == "Upload":
    upload.show()
elif page == "Übersicht":
    st.title("Übersicht")
elif page == "Prozessanalyse":
    st.title("Prozessanalyse")
elif page == "KI-Auswertung":
    st.title("KI-Auswertung")
