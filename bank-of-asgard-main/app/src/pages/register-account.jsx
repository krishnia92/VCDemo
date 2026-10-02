/**
 * Copyright (c) 2025, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useAsgardeo } from "@asgardeo/react";
import EverydayBanking from "../assets/images/A_women_laying_on_a_soft_with_a_headset_and_holdin_028d291b-58ee-4de5-8c57-2a84033209ac.png";
import GatacaImage from "../assets/images/asgard_wallet_custom_qr.png";
import { SITE_SECTIONS } from "../constants/app-constants";
import { isFeatureEnabled } from "../util/environment-util";
import { FEATURE_MAP } from "../constants/feature-constants";

const RegisterAccountPage = ({ setSiteSection }) => {

  const { signIn } = useAsgardeo();
  const [ showModal, setShowModal ] = useState(false);

  const isOdinWalletEnabled = isFeatureEnabled(FEATURE_MAP.ODIN_WALLET);

  useEffect(() => {
    setSiteSection(SITE_SECTIONS.PERSONAL);
  }, []);

  useEffect(() => {
    if (showModal) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    // Cleanup when component unmounts
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [ showModal ]);

  return (
    <>
      <section className="about_section layout_padding">
        <div className="container">

          <div className="heading_container">
            <h2>Open your account</h2>
          </div>
          <div className="register-page-banner">
            <img src={ EverydayBanking } alt="" style={ { width: "100%", marginTop: "-95px" } } />
          </div>
          <div className="row">
            <div className="col-md-8 px-0">
              <div className="contact_section">
                <div className="container">
                  <div className="row">
                    <div className="col-md-7">
                      <h4>Create your account</h4>
                      <p>
                        You&apos;ll be securely redirected to complete registration.
                      </p>
                      {/* See App.jsx for why this goes through signIn(), not a plain link. */}
                      <button type="button" className="btn" onClick={ () => signIn({ flowType: "REGISTRATION" }) }>
                        Open an account
                      </button>
                    </div>
                    { isOdinWalletEnabled &&
                      <div className="col-md-2 mx-auto" style={ { textAlign: "center" } }>
                        <h4>OR</h4>
                      </div>
                    }
                  </div>
                </div>
              </div>
            </div>
            { isOdinWalletEnabled && (
              <div className="col-md-4 px-0">
                <div className="detail-box" style={ { marginTop: "200px" } }>
                  <div className="heading_container ">
                    <h2>Open instantly</h2>
                  </div>

                  <button type="button" className="btn btn-primary verify-button" onClick={ () => setShowModal(true) }>
                    <span className="icon">
                      <i className="fa fa-id-badge"></i>
                    </span>
                    <span className="text">
                      <h4>Verify your Self</h4>
                      with Odin
                    </span>
                  </button>

                  <p>
                    You can use your Odin Wallet to open an account instantly.
                  </p>
                </div>
              </div>
            ) }
          </div>
        </div>
      </section>

      <div id="exampleModalLive" className="modal fade show" tabIndex={-1} role="dialog" aria-labelledby="exampleModalLiveLabel" style={{ display: showModal ? "block" : "none", zIndex: showModal ? "100000" : "-1" }}>
        <div className="modal" tabIndex={-1} role="dialog" style={{ display: showModal ? "block" : "none" }}>
          <div className="modal-dialog" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <button type="button" className="close" data-dismiss="modal" aria-label="Close" onClick={ () => setShowModal(false) }>
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>
              <div className="modal-body">
                <p><img src={ GatacaImage } style={ { maxWidth: "100%" }} /></p>
                <p style={ { padding: "0 25px" } }>
                  Please scan the QR code with your Odin Wallet for us to verify your identity.
                </p>
              </div>
              {/* <div className="modal-footer">
                <button type="button" className="btn btn-secondary" data-dismiss="modal" onClick={ () => setShowModal(false) }>Close</button>
              </div> */}
            </div>
          </div>
        </div>
      </div>

      <div className={ `modal-backdrop fade ${showModal ? "show" : ""} `}  style={{ zIndex: showModal ? "1" : "-1" }}></div>
    </>
  );
}

RegisterAccountPage.propTypes = {
  setSiteSection: PropTypes.object.isRequired,
};

export default RegisterAccountPage;
